#!/usr/bin/env python3
"""Preprocess raw handwriting stroke data into normalized CharacterSamples.

Expected raw input format (JSON):
{
  "samples": [
    {
      "char": "a",
      "strokes": [[[x1, y1], [x2, y2, pressure], ...], ...],
      "source_id": "optional_id",
      "tag": "mathvar" | "mathdelim" | null,
      "canvas": {
        "width": 320, "height": 160,
        "baseline_y": 112, "xheight_y": 64
      }
    },
    ...
  ]
}

Or a directory of per-character JSON files in the same shape.

The `canvas` field is what makes preprocessing portable: each sample carries
the geometry of the canvas it was drawn on, so resizing the collection UI
later doesn't silently misalign older samples. Samples saved before this
field existed fall back to LEGACY_CANVAS below.

Usage:
    python scripts/preprocess.py data/raw_samples/ data/processed/
    python scripts/preprocess.py data/raw_samples/samples.json data/processed/
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from renderer.glyph_model import CharacterSample, Stroke


# --- Validation ---

MIN_POINTS_PER_STROKE = 2
MIN_STROKES = 1
# Allow stroke points up to this fraction outside the canvas bounds before
# rejecting — covers cases where the pointer briefly overshoots the edge.
CANVAS_OVERSHOOT_TOLERANCE = 0.05


# Default canvas geometry for samples that don't carry their own. Matches the
# 320x160 layout in collect-app/public/index.html (h=160, baseline at h*0.7,
# x-height at h*0.4). Older samples were drawn under various sizes; this is
# the closest plausible default and produces a clear warning so the user
# knows to recollect if needed.
LEGACY_CANVAS = {
    "width": 320,
    "height": 160,
    "baseline_y": 112,   # h * 0.7
    "xheight_y": 64,     # h * 0.4
}


def _resolve_canvas(canvas: dict | None) -> dict:
    """Fill in missing canvas-geometry fields from LEGACY_CANVAS."""
    if not canvas:
        return dict(LEGACY_CANVAS)
    out = dict(LEGACY_CANVAS)
    out.update({k: v for k, v in canvas.items() if v is not None})
    return out


def validate_raw_sample(
    char: str,
    strokes: list[list[list[float]]],
    canvas: dict | None = None,
) -> str | None:
    """Return an error message if invalid, or None if OK."""
    if not char or len(char) != 1:
        return f"char must be a single character, got {repr(char)}"
    if len(strokes) < MIN_STROKES:
        return f"need at least {MIN_STROKES} stroke(s), got {len(strokes)}"
    cv = _resolve_canvas(canvas)
    x_lo = -cv["width"] * CANVAS_OVERSHOOT_TOLERANCE
    x_hi = cv["width"] * (1 + CANVAS_OVERSHOOT_TOLERANCE)
    y_lo = -cv["height"] * CANVAS_OVERSHOOT_TOLERANCE
    y_hi = cv["height"] * (1 + CANVAS_OVERSHOOT_TOLERANCE)
    for i, stroke in enumerate(strokes):
        if len(stroke) < MIN_POINTS_PER_STROKE:
            return f"stroke {i} has {len(stroke)} points, need at least {MIN_POINTS_PER_STROKE}"
        for j, pt in enumerate(stroke):
            if len(pt) < 2:
                return f"stroke {i} point {j} has {len(pt)} coords, need at least 2"
            if not all(math.isfinite(v) for v in pt[:2]):
                return f"stroke {i} point {j} has non-finite coords"
            x, y = pt[0], pt[1]
            if not (x_lo <= x <= x_hi and y_lo <= y <= y_hi):
                return (
                    f"stroke {i} point {j} ({x:.1f}, {y:.1f}) "
                    f"is outside canvas {cv['width']}x{cv['height']}"
                )
    return None


# --- Normalization ---

def _bounding_box(strokes: list[Stroke]) -> tuple[float, float, float, float]:
    """Return (min_x, min_y, max_x, max_y) for all points."""
    xs = [pt[0] for stroke in strokes for pt in stroke]
    ys = [pt[1] for stroke in strokes for pt in stroke]
    return min(xs), min(ys), max(xs), max(ys)


def _stroke_has_pressure(raw_strokes: list[list[list[float]]]) -> bool:
    """True if any point carries a third coordinate (pressure)."""
    for stroke in raw_strokes:
        for pt in stroke:
            if len(pt) > 2:
                return True
    return False


def normalize_sample(
    char: str,
    raw_strokes: list[list[list[float]]],
    source_id: str = "",
    target_height: float = 1.0,
    canvas: dict | None = None,
) -> CharacterSample:
    """Normalize a raw sample into a CharacterSample.

    Raw input uses the canvas's CSS pixel space (y increases downward).
    Output uses typographic coordinates: y increases upward, 0 = baseline.

    Scaling is relative to the canvas's x-height zone (the gap between the
    baseline and x-height guidelines), so all characters keep their natural
    proportions — a period stays small, a hyphen stays short, and tall
    characters are naturally tall because the user drew them that way.
    """
    cv = _resolve_canvas(canvas)
    has_pressure = _stroke_has_pressure(raw_strokes)

    # Scale relative to the canvas x-height zone, mapping it to target_height
    # (default 1.0). Every character uses the same scale, so proportions are
    # preserved across the alphabet.
    xheight_px = cv["baseline_y"] - cv["xheight_y"]
    if xheight_px <= 0:
        raise ValueError(
            f"canvas baseline_y ({cv['baseline_y']}) must be greater than "
            f"xheight_y ({cv['xheight_y']})"
        )
    scale = target_height / xheight_px

    # Shift x so the leftmost point is at 0; flip y, scale, and place baseline at y=0.
    raw_min_x = min(pt[0] for stroke in raw_strokes for pt in stroke)
    strokes = _shift_and_scale(raw_strokes, has_pressure, raw_min_x, scale)
    baseline_y_norm = cv["baseline_y"] * scale  # canvas baseline maps to here in flipped+scaled space
    strokes = _shift_y(strokes, baseline_y_norm, has_pressure)

    min_x2, min_y2, max_x2, max_y2 = _bounding_box(strokes)
    width = max_x2 - min_x2
    height = max_y2 - min_y2

    return CharacterSample(
        char=char,
        strokes=strokes,
        width=width,
        height=height,
        source_id=source_id,
        tags=[],
        has_pressure=has_pressure,
    )


def _shift_and_scale(
    raw_strokes: list[list[list[float]]],
    has_pressure: bool,
    min_x: float,
    scale: float,
) -> list[Stroke]:
    """Scale (x, y) by `scale` after subtracting min_x; flip y. Preserve pressure if present."""
    out: list[Stroke] = []
    for stroke in raw_strokes:
        s: list[tuple[float, ...]] = []
        for pt in stroke:
            x = (pt[0] - min_x) * scale
            y = -pt[1] * scale
            if has_pressure:
                p = pt[2] if len(pt) > 2 else 0.5
                s.append((x, y, p))
            else:
                s.append((x, y))
        out.append(s)
    return out


def _shift_y(strokes: list[Stroke], dy: float, has_pressure: bool) -> list[Stroke]:
    out: list[Stroke] = []
    for stroke in strokes:
        s: list[tuple[float, ...]] = []
        for pt in stroke:
            if has_pressure:
                s.append((pt[0], pt[1] + dy, pt[2]))
            else:
                s.append((pt[0], pt[1] + dy))
        out.append(s)
    return out


# --- I/O ---

def load_raw_samples(
    path: Path,
) -> list[tuple[str, list[list[list[float]]], str, str | None, dict | None]]:
    """Load raw samples from a file or directory.

    Returns list of (char, strokes, source_id, tag, canvas) tuples.
    """
    path = Path(path)
    samples = []

    def _extract(entry, fallback_id):
        samples.append((
            entry["char"],
            entry["strokes"],
            entry.get("source_id", fallback_id),
            entry.get("tag", None),
            entry.get("canvas", None),
        ))

    if path.is_file():
        data = json.loads(path.read_text())
        for entry in data.get("samples", []):
            _extract(entry, path.stem)
    elif path.is_dir():
        for f in sorted(path.glob("*.json")):
            data = json.loads(f.read_text())
            if "samples" in data:
                for entry in data["samples"]:
                    _extract(entry, f.stem)
            elif "char" in data and "strokes" in data:
                _extract(data, f.stem)
    else:
        raise FileNotFoundError(f"Path not found: {path}")

    return samples


def preprocess_all(
    input_path: Path,
    output_path: Path,
) -> tuple[int, int]:
    """Preprocess all raw samples and save processed output.

    Returns (processed_count, rejected_count).
    """
    raw_samples = load_raw_samples(input_path)
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    # Key is (tag, char) to keep tagged and untagged samples separate
    processed_by_key: dict[tuple[str | None, str], list[dict]] = {}
    processed_count = 0
    rejected_count = 0
    legacy_canvas_count = 0
    pressure_present = 0
    pressure_absent = 0

    for char, strokes, source_id, tag, canvas in raw_samples:
        error = validate_raw_sample(char, strokes, canvas)
        if error:
            print(f"  REJECT [{char}] {source_id}: {error}")
            rejected_count += 1
            continue
        if not canvas:
            legacy_canvas_count += 1

        sample = normalize_sample(char, strokes, source_id, canvas=canvas)
        if tag:
            sample.tags = [tag]
        if sample.has_pressure:
            pressure_present += 1
        else:
            pressure_absent += 1
        processed_by_key.setdefault((tag, char), []).append(sample.to_dict())
        processed_count += 1

    # One JSON file per (tag, character).
    for (tag, char), variants in processed_by_key.items():
        safe_name = char if char.isalnum() and char.islower() else (
            f"upper_{char}" if char.isupper() else f"u{ord(char):04x}"
        )
        if tag:
            safe_name = f"{tag}_{safe_name}"
        out_file = output_path / f"{safe_name}.json"
        out_file.write_text(json.dumps({
            "char": char,
            "tag": tag,
            "variants": variants,
        }, indent=2))

    if legacy_canvas_count:
        print(f"  note: {legacy_canvas_count} sample(s) had no canvas field — "
              f"used legacy {LEGACY_CANVAS['width']}x{LEGACY_CANVAS['height']}. "
              "Recollect for accurate baseline alignment.")
    if pressure_present and pressure_absent:
        print(f"  note: mixed pressure data ({pressure_present} with, "
              f"{pressure_absent} without) — width modulation will differ "
              "between samples.")

    return processed_count, rejected_count


def main():
    parser = argparse.ArgumentParser(description="Preprocess raw handwriting samples")
    parser.add_argument("input", type=Path, help="Raw samples file or directory")
    parser.add_argument("output", type=Path, help="Output directory for processed samples")
    args = parser.parse_args()

    print(f"Loading raw samples from {args.input}...")
    processed, rejected = preprocess_all(args.input, args.output)
    print(f"Done: {processed} processed, {rejected} rejected")
    print(f"Output saved to {args.output}/")


if __name__ == "__main__":
    main()
