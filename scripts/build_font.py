#!/usr/bin/env python3
"""Build an OpenType font from preprocessed handwriting samples.

Converts handwriting stroke data (with pressure when available) into font
glyph outlines and writes a .otf file usable directly in LaTeX.

Usage:
    python scripts/build_font.py data/processed/ outputs/HandwritingFont.otf

Alongside the .otf, a sidecar `<output>.manifest.json` records what went
into the build (sample hash, char counts, pressure availability, canvas
geometries) so stale builds are visible when inputs change later.
"""

import argparse
import datetime as _dt
import hashlib
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib.tables import otTables

from renderer.glyph_model import CharacterSample, SampleLibrary, Stroke

FONT_NAME = "Handwriting"


# Font metrics in font units (UPM = units per em)
UPM = 1000
ASCENDER = 800
DESCENDER = -200
X_HEIGHT = 500
CAP_HEIGHT = 700
STROKE_BASE_WIDTH = 50  # base width for pressure outlines in font units


def _get_pressure(pt: tuple[float, ...]) -> float:
    return pt[2] if len(pt) > 2 else 0.5


def _smooth_pressures(pressures: list[float], window: int = 5) -> list[float]:
    if len(pressures) <= window:
        return pressures
    smoothed = []
    half = window // 2
    for i in range(len(pressures)):
        lo = max(0, i - half)
        hi = min(len(pressures), i + half + 1)
        smoothed.append(sum(pressures[lo:hi]) / (hi - lo))
    return smoothed


def _compute_velocities(stroke: Stroke) -> list[float]:
    if len(stroke) < 2:
        return [0.0] * len(stroke)
    dists = [0.0]
    for i in range(1, len(stroke)):
        dx = stroke[i][0] - stroke[i - 1][0]
        dy = stroke[i][1] - stroke[i - 1][1]
        dists.append(math.sqrt(dx * dx + dy * dy))
    max_dist = max(dists) if max(dists) > 0 else 1.0
    return [d / max_dist for d in dists]


def stroke_to_outline_points(
    stroke: Stroke,
    base_width: float,
    has_pressure: bool,
) -> list[tuple[float, float]]:
    """Convert a stroke into a closed outline polygon.

    When `has_pressure` is True, width is modulated by smoothed pressure.
    When False, width is driven by velocity + endpoint taper only — the
    constant-pressure plateau (every point at 0.5) that older samples produce
    would otherwise look indistinguishably flat.
    """
    if len(stroke) < 2:
        return []

    n = len(stroke)
    pressures = _smooth_pressures([_get_pressure(pt) for pt in stroke]) if has_pressure else None
    velocities = _compute_velocities(stroke)

    min_w = base_width * 0.3
    max_w = base_width * 1.0
    taper_len = min(n // 5, 8)

    left_pts: list[tuple[float, float]] = []
    right_pts: list[tuple[float, float]] = []

    for i in range(n):
        x, y = stroke[i][0], stroke[i][1]

        if has_pressure:
            width = min_w + (max_w - min_w) * (pressures[i] ** 0.8)
        else:
            # Without pressure, sit at the upper-middle of the range and let
            # velocity + taper do all the variation.
            width = min_w + (max_w - min_w) * 0.7

        vel_factor = 1.0 - velocities[i] * 0.3
        width *= vel_factor

        if taper_len > 0:
            if i < taper_len:
                width *= 0.4 + 0.6 * (i / taper_len)
            elif i > n - 1 - taper_len:
                width *= 0.4 + 0.6 * ((n - 1 - i) / taper_len)

        half_w = width / 2

        if i == 0:
            dx = stroke[1][0] - x
            dy = stroke[1][1] - y
        elif i == n - 1:
            dx = x - stroke[i - 1][0]
            dy = y - stroke[i - 1][1]
        else:
            dx = stroke[i + 1][0] - stroke[i - 1][0]
            dy = stroke[i + 1][1] - stroke[i - 1][1]

        length = math.sqrt(dx * dx + dy * dy)
        if length < 1e-10:
            nx, ny = 0.0, 1.0
        else:
            nx, ny = -dy / length, dx / length

        left_pts.append((x + nx * half_w, y + ny * half_w))
        right_pts.append((x - nx * half_w, y - ny * half_w))

    return left_pts + list(reversed(right_pts))


def sample_to_glyph_outlines(
    sample: CharacterSample,
    font_scale: float,
) -> list[list[tuple[float, float]]]:
    """Convert a CharacterSample into glyph outline contours in font units."""
    contours = []
    for stroke in sample.strokes:
        scaled: Stroke = [
            (pt[0] * font_scale, pt[1] * font_scale) + tuple(pt[2:])
            for pt in stroke
        ]
        outline = stroke_to_outline_points(scaled, STROKE_BASE_WIDTH, sample.has_pressure)
        if len(outline) >= 3:
            contours.append(outline)
    return contours


def build_font(
    library: SampleLibrary,
    output_path: Path,
) -> None:
    """Build an OpenType font from the sample library."""

    # One sample per (tag, char). When multiple samples exist for a key we
    # take the first — picking among variants would be the natural place to
    # add OpenType contextual alternates later.
    def _pick(tag: str | None) -> dict[str, CharacterSample]:
        out: dict[str, CharacterSample] = {}
        for char in library.chars(tag=tag):
            variants = library.get(char, tag=tag)
            if variants:
                out[char] = variants[0]
        return out

    glyphs = _pick(None)
    mathvar_glyphs = _pick("mathvar")
    mathdelim_glyphs = _pick("mathdelim")

    print(f"Building font with {len(glyphs)} text glyphs, {len(mathvar_glyphs)} math variable glyphs, {len(mathdelim_glyphs)} math delimiter glyphs...")

    # Scale: normalized x-height (1.0) → X_HEIGHT font units
    font_scale = X_HEIGHT

    # Build glyph names and cmap
    glyph_names = [".notdef", "space"]
    char_to_glyph_name: dict[str, str] = {}
    cmap: dict[int, str] = {}

    for char in sorted(glyphs.keys()):
        if char.isascii() and char.isalpha():
            gname = f"upper_{char}" if char.isupper() else char
        elif char.isascii() and char.isdigit():
            gname = f"digit_{char}"
        else:
            gname = f"uni{ord(char):04X}"

        glyph_names.append(gname)
        char_to_glyph_name[char] = gname
        cmap[ord(char)] = gname

    cmap[0x20] = "space"

    # Alias math characters to their ASCII equivalents so LaTeX math mode
    # picks up our handwriting glyphs instead of falling back to Latin Modern.
    aliases = {
        0x2212: 0x002D,  # MINUS SIGN → HYPHEN-MINUS
        0x2217: 0x002A,  # ASTERISK OPERATOR → ASTERISK
        0x2215: 0x002F,  # DIVISION SLASH → SOLIDUS
    }

    # unicode-math remaps letters/digits/Greek to Mathematical Alphanumeric
    # Symbols (U+1D400+). If mathvar samples exist, those get their own glyphs
    # at the math-italic codepoints. Otherwise, alias back to text glyphs.

    # Build mathvar glyphs first so we can reference them in cmap
    mathvar_glyph_names: dict[str, str] = {}  # char -> glyph name for mathvar
    for char, sample in mathvar_glyphs.items():
        if char.isascii() and char.isalpha():
            gname = f"mathvar_upper_{char}" if char.isupper() else f"mathvar_{char}"
        else:
            gname = f"mathvar_uni{ord(char):04X}"
        mathvar_glyph_names[char] = gname
        glyph_names.append(gname)
        # Don't add to cmap yet — the math-italic codepoint aliases will handle that

    # Math Italic: a-z → U+1D44E..U+1D467, A-Z → U+1D434..U+1D44D
    for i in range(26):
        for cp_base, ascii_base in [(0x1D44E, ord('a')), (0x1D434, ord('A'))]:
            ch = chr(ascii_base + i)
            if ch in mathvar_glyph_names:
                cmap[cp_base + i] = mathvar_glyph_names[ch]
            else:
                aliases[cp_base + i] = ascii_base + i

    # Math Bold: a-z → U+1D41A..U+1D433, A-Z → U+1D400..U+1D419
    for i in range(26):
        for cp_base, ascii_base in [(0x1D41A, ord('a')), (0x1D400, ord('A'))]:
            ch = chr(ascii_base + i)
            if ch in mathvar_glyph_names:
                cmap[cp_base + i] = mathvar_glyph_names[ch]
            else:
                aliases[cp_base + i] = ascii_base + i

    # Math Bold Italic: a-z → U+1D482..U+1D49B, A-Z → U+1D468..U+1D481
    for i in range(26):
        for cp_base, ascii_base in [(0x1D482, ord('a')), (0x1D468, ord('A'))]:
            ch = chr(ascii_base + i)
            if ch in mathvar_glyph_names:
                cmap[cp_base + i] = mathvar_glyph_names[ch]
            else:
                aliases[cp_base + i] = ascii_base + i

    # Math Sans-Serif Italic: a-z → U+1D622..U+1D63B, A-Z → U+1D608..U+1D621
    for i in range(26):
        for cp_base, ascii_base in [(0x1D622, ord('a')), (0x1D608, ord('A'))]:
            ch = chr(ascii_base + i)
            if ch in mathvar_glyph_names:
                cmap[cp_base + i] = mathvar_glyph_names[ch]
            else:
                aliases[cp_base + i] = ascii_base + i

    # Math Italic Greek: α-ω → U+1D6FC..U+1D714, Α-Ω → U+1D6E2..U+1D6FA
    greek_lower = "αβγδεζηθικλμνξοπρςστυφχψω"
    greek_upper = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ\x00ΣΤΥΦΧΨΩ"  # no Q equivalent
    for i, ch in enumerate(greek_lower):
        if ord(ch) in cmap:
            aliases[0x1D6FC + i] = ord(ch)
    for i, ch in enumerate(greek_upper):
        if ch != '\x00' and ord(ch) in cmap:
            aliases[0x1D6E2 + i] = ord(ch)

    # Math Bold Greek lowercase/uppercase
    for i, ch in enumerate(greek_lower):
        if ord(ch) in cmap:
            aliases[0x1D6C2 + i] = ord(ch)
    for i, ch in enumerate(greek_upper):
        if ch != '\x00' and ord(ch) in cmap:
            aliases[0x1D6A8 + i] = ord(ch)

    # Special math symbols
    aliases[0x1D715] = 0x2202  # Math Italic Partial → ∂
    aliases[0x1D6DB] = 0x2202  # Math Bold Partial → ∂
    aliases[0x1D6FB] = 0x2207  # Math Italic Nabla → ∇
    aliases[0x1D6C1] = 0x2207  # Math Bold Nabla → ∇
    aliases[0x1D70B] = 0x03C0  # Math Italic Pi → π
    aliases[0x210E] = ord('h')  # Planck constant → h
    aliases[0x2236] = ord(':')  # Ratio → colon
    aliases[0x1D716] = 0x03B5  # Math Italic Epsilon variant → ε
    aliases[0x1D719] = 0x03C6  # Math Italic Phi variant → φ
    aliases[0x1D6DC] = 0x03B5  # Math Bold Epsilon variant → ε
    aliases[0x1D6DF] = 0x03C6  # Math Bold Phi variant → φ

    # Math digits (bold): 0-9 → U+1D7CE..U+1D7D7
    for i in range(10):
        aliases[0x1D7CE + i] = ord('0') + i  # bold
        aliases[0x1D7E2 + i] = ord('0') + i  # sans-serif
        aliases[0x1D7EC + i] = ord('0') + i  # sans-serif bold
        aliases[0x1D7F6 + i] = ord('0') + i  # monospace

    for math_cp, ascii_cp in aliases.items():
        if ascii_cp in cmap and math_cp not in cmap:
            cmap[math_cp] = cmap[ascii_cp]

    # Build charstrings using T2CharStringPen
    charstrings: dict[str, any] = {}

    # .notdef — empty
    pen = T2CharStringPen(500, None)
    charstrings[".notdef"] = pen.getCharString()

    # space
    space_width = int(font_scale * 0.5)
    pen = T2CharStringPen(space_width, None)
    charstrings["space"] = pen.getCharString()

    # Character glyphs
    glyph_widths: dict[str, int] = {".notdef": 500, "space": space_width}
    glyph_lsbs: dict[str, int] = {".notdef": 0, "space": 0}

    # Compute median width for proportional bearing adjustment
    all_widths = [glyphs[c].width for c in sorted(glyphs.keys())]
    median_width = sorted(all_widths)[len(all_widths) // 2] if all_widths else 1.0

    for char in sorted(glyphs.keys()):
        sample = glyphs[char]
        gname = char_to_glyph_name[char]
        contours = sample_to_glyph_outlines(sample, font_scale)
        # Compute actual glyph width from rendered contours (not center line)
        all_xs = [x for contour in contours for x, y in contour]
        min_x = min(all_xs) if all_xs else 0
        max_x = max(all_xs) if all_xs else 0
        contour_width = max_x - min_x

        # Extra spacing scaled proportionally to glyph width —
        # thin letters (i, j, l, t, r, f) get less padding
        width_ratio = min(1.0, contour_width / (median_width * font_scale)) if median_width > 0 else 1.0
        extra_bearing = font_scale * 0.08 * (0.1 + 0.9 * width_ratio)

        # Advance width based on actual contour width, not center line
        advance_width = int(contour_width + extra_bearing * 2)
        advance_width = max(advance_width, 100)

        # Shift contours so they start at extra_bearing
        x_shift = extra_bearing - min_x

        pen = T2CharStringPen(advance_width, None)
        for contour in contours:
            if len(contour) < 3:
                continue
            pts = [(int(round(x + x_shift)), int(round(y))) for x, y in contour]
            pen.moveTo(pts[0])
            for pt in pts[1:]:
                pen.lineTo(pt)
            pen.closePath()
        charstrings[gname] = pen.getCharString()

        glyph_widths[gname] = advance_width
        glyph_lsbs[gname] = int(extra_bearing)

    # Build mathvar glyphs (math variable style — separate outlines)
    for char, sample in mathvar_glyphs.items():
        gname = mathvar_glyph_names[char]
        contours = sample_to_glyph_outlines(sample, font_scale)

        all_xs = [x for contour in contours for x, y in contour]
        min_x = min(all_xs) if all_xs else 0
        max_x = max(all_xs) if all_xs else 0
        contour_width = max_x - min_x

        width_ratio = min(1.0, contour_width / (median_width * font_scale)) if median_width > 0 else 1.0
        extra_bearing = font_scale * 0.08 * (0.1 + 0.9 * width_ratio)
        advance_width = int(contour_width + extra_bearing * 2)
        advance_width = max(advance_width, 100)
        x_shift = extra_bearing - min_x

        pen = T2CharStringPen(advance_width, None)
        for contour in contours:
            if len(contour) < 3:
                continue
            pts = [(int(round(x + x_shift)), int(round(y))) for x, y in contour]
            pen.moveTo(pts[0])
            for pt in pts[1:]:
                pen.lineTo(pt)
            pen.closePath()
        charstrings[gname] = pen.getCharString()

        glyph_widths[gname] = advance_width
        glyph_lsbs[gname] = int(extra_bearing)

    # Generate size variants for stretchy delimiters.
    # For each delimiter, create scaled versions at 1.2x, 1.8x, 2.4x, 3.2x height.
    delimiter_chars = "()[]{}|"
    size_scales = [1.2, 1.8, 2.4, 3.2, 4.2, 5.5, 7.0, 9.0]
    # Maps base glyph name -> list of (variant glyph name, advance measurement)
    # Includes the base glyph as the first entry.
    delimiter_variants: dict[str, list[tuple[str, int]]] = {}

    for char in delimiter_chars:
        if char not in char_to_glyph_name:
            continue
        base_gname = char_to_glyph_name[char]
        if base_gname not in charstrings:
            continue

        sample = glyphs[char]
        base_contours = sample_to_glyph_outlines(sample, font_scale)

        # Compute base glyph height from its contours
        all_ys = [y for contour in base_contours for x, y in contour]
        base_height = int(max(all_ys) - min(all_ys)) if all_ys else 1000

        # Start variant list with the base glyph itself
        variant_entries: list[tuple[str, int]] = [(base_gname, base_height)]

        for si, s in enumerate(size_scales):
            vname = f"{base_gname}.size{si + 1}"
            glyph_names.append(vname)

            # Scale contours vertically by s, keeping width the same
            scaled_contours = []
            for contour in base_contours:
                scaled_contours.append([(x, y * s) for x, y in contour])

            variant_height = int(base_height * s)
            variant_entries.append((vname, variant_height))

            vwidth = glyph_widths[base_gname]
            pen = T2CharStringPen(vwidth, None)
            for contour in scaled_contours:
                if len(contour) < 3:
                    continue
                pts = [(int(round(x)), int(round(y))) for x, y in contour]
                pen.moveTo(pts[0])
                for pt in pts[1:]:
                    pen.lineTo(pt)
                pen.closePath()
            charstrings[vname] = pen.getCharString()
            glyph_widths[vname] = vwidth
            glyph_lsbs[vname] = glyph_lsbs.get(base_gname, 0)

        delimiter_variants[base_gname] = variant_entries

    # Build the font
    fb = FontBuilder(UPM, isTTF=False)
    fb.setupGlyphOrder(glyph_names)
    fb.setupCharacterMap(cmap)

    fb.setupCFF(
        psName=FONT_NAME,
        fontInfo={"FullName": FONT_NAME},
        charStringsDict=charstrings,
        privateDict={},
    )

    metrics = {gname: (glyph_widths[gname], glyph_lsbs.get(gname, 0))
               for gname in glyph_names}
    fb.setupHorizontalMetrics(metrics)

    fb.setupHorizontalHeader(
        ascent=ASCENDER,
        descent=DESCENDER,
    )

    fb.setupNameTable({
        "familyName": FONT_NAME,
        "styleName": "Regular",
    })

    fb.setupOS2(
        sTypoAscender=ASCENDER,
        sTypoDescender=DESCENDER,
        sxHeight=X_HEIGHT,
        sCapHeight=CAP_HEIGHT,
    )

    fb.setupPost()

    # Add OpenType MATH table so LaTeX can use this font for math layout.
    # Constants are based on Latin Modern Math, which uses UPM=1000 (same as ours).
    _add_math_table(fb.font, glyph_names, delimiter_variants)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fb.font.save(str(output_path))
    print(f"Font saved to {output_path}")
    print(f"  {len(glyphs)} character glyphs + space + .notdef")
    return {
        "text_glyphs": sorted(glyphs.keys()),
        "mathvar_glyphs": sorted(mathvar_glyphs.keys()),
        "mathdelim_glyphs": sorted(mathdelim_glyphs.keys()),
    }


def _make_math_value(value: int) -> otTables.MathValueRecord:
    """Create a MathValueRecord with the given value."""
    rec = otTables.MathValueRecord()
    rec.Value = value
    rec.DeviceTable = None
    return rec


def _add_math_table(font, glyph_names: list[str], delimiter_variants: dict[str, list[str]] | None = None) -> None:
    """Add an OpenType MATH table to the font.

    This enables LaTeX (via unicode-math) to use this font for math typesetting,
    including fractions, superscripts, subscripts, radicals, etc.

    Constants are based on Latin Modern Math (UPM=1000, same as ours).
    """
    from fontTools.ttLib import newTable

    math_table = newTable("MATH")
    math_table.table = otTables.MATH()
    math_table.table.Version = 0x00010000

    # --- MathConstants ---
    mc = otTables.MathConstants()

    mc.ScriptPercentScaleDown = 70
    mc.ScriptScriptPercentScaleDown = 50
    mc.DelimitedSubFormulaMinHeight = 1500
    mc.DisplayOperatorMinHeight = 1450
    mc.MathLeading = _make_math_value(150)
    mc.AxisHeight = _make_math_value(250)
    mc.AccentBaseHeight = _make_math_value(450)
    mc.FlattenedAccentBaseHeight = _make_math_value(650)

    mc.SubscriptShiftDown = _make_math_value(247)
    mc.SubscriptTopMax = _make_math_value(344)
    mc.SubscriptBaselineDropMin = _make_math_value(50)
    mc.SuperscriptShiftUp = _make_math_value(363)
    mc.SuperscriptShiftUpCramped = _make_math_value(289)
    mc.SuperscriptBottomMin = _make_math_value(108)
    mc.SuperscriptBaselineDropMax = _make_math_value(386)
    mc.SubSuperscriptGapMin = _make_math_value(150)
    mc.SuperscriptBottomMaxWithSubscript = _make_math_value(344)
    mc.SpaceAfterScript = _make_math_value(41)

    mc.UpperLimitGapMin = _make_math_value(150)
    mc.UpperLimitBaselineRiseMin = _make_math_value(300)
    mc.LowerLimitGapMin = _make_math_value(150)
    mc.LowerLimitBaselineDropMin = _make_math_value(600)

    mc.StackTopShiftUp = _make_math_value(480)
    mc.StackTopDisplayStyleShiftUp = _make_math_value(580)
    mc.StackBottomShiftDown = _make_math_value(350)
    mc.StackBottomDisplayStyleShiftDown = _make_math_value(350)
    mc.StackGapMin = _make_math_value(150)
    mc.StackDisplayStyleGapMin = _make_math_value(300)

    mc.StretchStackTopShiftUp = _make_math_value(800)
    mc.StretchStackBottomShiftDown = _make_math_value(600)
    mc.StretchStackGapAboveMin = _make_math_value(150)
    mc.StretchStackGapBelowMin = _make_math_value(150)

    mc.FractionNumeratorShiftUp = _make_math_value(394)
    mc.FractionNumeratorDisplayStyleShiftUp = _make_math_value(677)
    mc.FractionDenominatorShiftDown = _make_math_value(345)
    mc.FractionDenominatorDisplayStyleShiftDown = _make_math_value(686)
    mc.FractionNumeratorGapMin = _make_math_value(40)
    mc.FractionNumDisplayStyleGapMin = _make_math_value(120)
    mc.FractionRuleThickness = _make_math_value(40)
    mc.FractionDenominatorGapMin = _make_math_value(40)
    mc.FractionDenomDisplayStyleGapMin = _make_math_value(120)

    mc.SkewedFractionHorizontalGap = _make_math_value(300)
    mc.SkewedFractionVerticalGap = _make_math_value(60)

    mc.OverbarVerticalGap = _make_math_value(150)
    mc.OverbarRuleThickness = _make_math_value(40)
    mc.OverbarExtraAscender = _make_math_value(40)

    mc.UnderbarVerticalGap = _make_math_value(150)
    mc.UnderbarRuleThickness = _make_math_value(40)
    mc.UnderbarExtraDescender = _make_math_value(40)

    mc.RadicalVerticalGap = _make_math_value(50)
    mc.RadicalDisplayStyleVerticalGap = _make_math_value(150)
    mc.RadicalRuleThickness = _make_math_value(40)
    mc.RadicalExtraAscender = _make_math_value(40)
    mc.RadicalKernBeforeDegree = _make_math_value(277)
    mc.RadicalKernAfterDegree = _make_math_value(-555)
    mc.RadicalDegreeBottomRaisePercent = 60

    mc.MinConnectorOverlap = 0

    math_table.table.MathConstants = mc

    # --- MathGlyphInfo (minimal) ---
    mgi = otTables.MathGlyphInfo()
    mgi.MathItalicsCorrectionInfo = None
    mgi.MathTopAccentAttachment = None
    mgi.ExtendedShapeCoverage = None
    mgi.MathKernInfo = None
    math_table.table.MathGlyphInfo = mgi

    # --- MathVariants — stretchy delimiters ---
    mv = otTables.MathVariants()
    mv.MinConnectorOverlap = 0
    mv.HorizGlyphCoverage = None
    mv.HorizGlyphCount = 0
    mv.HorizGlyphConstruction = []

    if delimiter_variants:
        # Build vertical glyph constructions for stretchy delimiters.
        # Must be sorted by glyph ID (position in glyph order).
        glyph_order = {name: idx for idx, name in enumerate(glyph_names)}
        sorted_bases = sorted(delimiter_variants.keys(), key=lambda g: glyph_order.get(g, 0))

        vert_glyphs = []
        vert_constructions = []

        for base_gname in sorted_bases:
            variant_entries = delimiter_variants[base_gname]
            vert_glyphs.append(base_gname)

            construction = otTables.MathGlyphConstruction()
            construction.GlyphAssembly = None  # no assembly, just size variants

            variants_list = []
            for vname, advance in variant_entries:
                record = otTables.MathGlyphVariantRecord()
                record.VariantGlyph = vname
                record.AdvanceMeasurement = advance
                variants_list.append(record)

            construction.MathGlyphVariantRecord = variants_list
            construction.VariantCount = len(variants_list)
            vert_constructions.append(construction)

        # Build coverage table (already sorted by glyph ID)
        coverage = otTables.Coverage()
        coverage.glyphs = vert_glyphs
        mv.VertGlyphCoverage = coverage
        mv.VertGlyphCount = len(vert_glyphs)
        mv.VertGlyphConstruction = vert_constructions
    else:
        mv.VertGlyphCoverage = None
        mv.VertGlyphCount = 0
        mv.VertGlyphConstruction = []
    math_table.table.MathVariants = mv

    font["MATH"] = math_table

    # Add GSUB and GPOS with 'math' script so unicode-math recognizes this
    # as a proper math font and doesn't fall back.
    _add_math_script_tables(font, glyph_names)


def _add_math_script_tables(font, glyph_names: list[str]) -> None:
    """Add GSUB (with ssty feature) and GPOS tables with 'math' script tag.

    The ssty (Script Style) feature is required for unicode-math to accept
    the font as a primary math font. We create a minimal ssty lookup that
    maps each glyph to itself (identity substitution) — the feature just
    needs to exist.
    """
    from fontTools.ttLib import newTable

    # --- GSUB with ssty feature ---
    gsub = otTables.GSUB()
    gsub.Version = 0x00010000

    # Build ssty lookup: SingleSubst (type 1) identity mapping for all glyphs
    # We only need a few representative glyphs for unicode-math to detect the feature
    alpha_glyphs = [g for g in glyph_names if g not in (".notdef", "space") and ".size" not in g]

    lookup = otTables.Lookup()
    lookup.LookupType = 1  # Single Substitution
    lookup.LookupFlag = 0
    lookup.SubTableCount = 1

    subtable = otTables.SingleSubst()
    subtable.mapping = {g: g for g in alpha_glyphs[:50]}  # identity map, subset is enough
    lookup.SubTable = [subtable]

    # Feature record for ssty
    feature_record = otTables.FeatureRecord()
    feature_record.FeatureTag = "ssty"
    feature_record.Feature = otTables.Feature()
    feature_record.Feature.FeatureParams = None
    feature_record.Feature.LookupListIndex = [0]
    feature_record.Feature.LookupCount = 1

    # Script record
    script_record = otTables.ScriptRecord()
    script_record.ScriptTag = "math"
    script_record.Script = otTables.Script()
    script_record.Script.DefaultLangSys = otTables.DefaultLangSys()
    script_record.Script.DefaultLangSys.ReqFeatureIndex = 0xFFFF
    script_record.Script.DefaultLangSys.FeatureIndex = [0]
    script_record.Script.LangSysRecord = []

    gsub.ScriptList = otTables.ScriptList()
    gsub.ScriptList.ScriptRecord = [script_record]
    gsub.FeatureList = otTables.FeatureList()
    gsub.FeatureList.FeatureRecord = [feature_record]
    gsub.LookupList = otTables.LookupList()
    gsub.LookupList.Lookup = [lookup]

    wrapper = newTable("GSUB")
    wrapper.table = gsub
    font["GSUB"] = wrapper

    # --- GPOS with math script (minimal, no features needed) ---
    gpos = otTables.GPOS()
    gpos.Version = 0x00010000

    script_record2 = otTables.ScriptRecord()
    script_record2.ScriptTag = "math"
    script_record2.Script = otTables.Script()
    script_record2.Script.DefaultLangSys = otTables.DefaultLangSys()
    script_record2.Script.DefaultLangSys.ReqFeatureIndex = 0xFFFF
    script_record2.Script.DefaultLangSys.FeatureIndex = []
    script_record2.Script.LangSysRecord = []

    gpos.ScriptList = otTables.ScriptList()
    gpos.ScriptList.ScriptRecord = [script_record2]
    gpos.FeatureList = otTables.FeatureList()
    gpos.FeatureList.FeatureRecord = []
    gpos.LookupList = otTables.LookupList()
    gpos.LookupList.Lookup = []

    wrapper2 = newTable("GPOS")
    wrapper2.table = gpos
    font["GPOS"] = wrapper2


def _hash_processed_dir(processed_dir: Path) -> str:
    """SHA-256 over the contents of every processed sample file, in sorted order.

    Stable across runs as long as the inputs are the same — used as the cache
    key in the build manifest.
    """
    h = hashlib.sha256()
    for f in sorted(processed_dir.glob("*.json")):
        h.update(f.name.encode("utf-8"))
        h.update(b"\0")
        h.update(f.read_bytes())
        h.update(b"\0")
    return h.hexdigest()


def _summarize_inputs(library: SampleLibrary) -> dict:
    pressure_with = pressure_without = 0
    for samples in library.samples.values():
        for s in samples:
            if s.has_pressure:
                pressure_with += 1
            else:
                pressure_without += 1
    return {
        "sample_count": library.count(),
        "char_count": len(library.chars()),
        "tagged_keys": len(library.samples),
        "pressure_with": pressure_with,
        "pressure_without": pressure_without,
    }


def write_manifest(
    output_path: Path,
    processed_dir: Path,
    library: SampleLibrary,
    glyphs: dict,
) -> Path:
    manifest = {
        "built_at": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "font_name": FONT_NAME,
        "samples_hash": _hash_processed_dir(processed_dir),
        **_summarize_inputs(library),
        **glyphs,
    }
    manifest_path = output_path.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2))
    return manifest_path


def main():
    parser = argparse.ArgumentParser(description="Build OpenType font from processed samples")
    parser.add_argument("input", type=Path, help="Processed samples directory (output of preprocess.py)")
    parser.add_argument("output", type=Path, help="Output .otf file path")
    args = parser.parse_args()

    print(f"Loading samples from {args.input}...")
    library = SampleLibrary.load(args.input)
    print(f"  {library.count()} samples across {len(library.chars())} characters")

    glyphs = build_font(library, args.output)
    manifest_path = write_manifest(args.output, args.input, library, glyphs)
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
