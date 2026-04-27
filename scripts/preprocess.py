#!/usr/bin/env python3
"""Preprocess raw handwriting stroke data into normalized CharacterSamples.

Expected raw input format (JSON):
{
  "samples": [
    {
      "char": "a",
      "strokes": [[[x1, y1], [x2, y2], ...], ...],
      "source_id": "optional_id"
    },
    ...
  ]
}

Or a directory of per-character JSON files named like a.json, upper_A.json, etc.

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
MAX_ASPECT_RATIO = 10.0  # reject absurdly tall/wide samples


def validate_raw_sample(char: str, strokes: list[list[list[float]]]) -> str | None:
    """Return an error message if invalid, or None if OK."""
    if not char or len(char) != 1:
        return f"char must be a single character, got {repr(char)}"
    if len(strokes) < MIN_STROKES:
        return f"need at least {MIN_STROKES} stroke(s), got {len(strokes)}"
    for i, stroke in enumerate(strokes):
        if len(stroke) < MIN_POINTS_PER_STROKE:
            return f"stroke {i} has {len(stroke)} points, need at least {MIN_POINTS_PER_STROKE}"
        for j, pt in enumerate(stroke):
            if len(pt) < 2:
                return f"stroke {i} point {j} has {len(pt)} coords, need at least 2"
            if not all(math.isfinite(v) for v in pt[:2]):
                return f"stroke {i} point {j} has non-finite coords"
    return None


# --- Normalization ---

# Canvas guideline positions (screen coords, y-down, on 300x150 canvas)
# These must match the guidelines drawn in collect-app/public/index.html
CANVAS_BASELINE_Y = 105   # h * 0.7
CANVAS_XHEIGHT_Y = 60     # h * 0.4
# The x-height zone in screen pixels — used as the reference for scaling
CANVAS_XHEIGHT_PX = CANVAS_BASELINE_Y - CANVAS_XHEIGHT_Y  # 45px


def _bounding_box(strokes: list[Stroke]) -> tuple[float, float, float, float]:
    """Return (min_x, min_y, max_x, max_y) for all points."""
    xs = [pt[0] for stroke in strokes for pt in stroke]
    ys = [pt[1] for stroke in strokes for pt in stroke]
    return min(xs), min(ys), max(xs), max(ys)


def _estimate_slant(strokes: list[Stroke]) -> float:
    """Estimate slant angle in radians from vertical strokes.

    Positive = leaning right. Returns 0 if not enough data.
    """
    # Look at roughly vertical segments (dy > dx)
    angles = []
    for stroke in strokes:
        for i in range(len(stroke) - 1):
            x1, y1 = stroke[i][0], stroke[i][1]
            x2, y2 = stroke[i + 1][0], stroke[i + 1][1]
            dx, dy = x2 - x1, y2 - y1
            if abs(dy) > abs(dx) and abs(dy) > 1e-6:
                angles.append(math.atan2(dx, dy))
    if not angles:
        return 0.0
    return sum(angles) / len(angles)


def normalize_sample(
    char: str,
    raw_strokes: list[list[list[float]]],
    source_id: str = "",
    target_height: float = 1.0,
    correct_slant: bool = False,
) -> CharacterSample:
    """Normalize a raw sample into a CharacterSample.

    The raw input uses screen coordinates (y increases downward).
    The output uses typographic coordinates (y increases upward, 0 = baseline).

    Scaling is relative to the canvas x-height zone (the space between the
    baseline and x-height guidelines). This means all characters keep their
    natural proportions — a period stays small, a hyphen stays short, and
    tall characters are naturally tall because the user drew them that way.

    Normalization steps:
    1. Flip y-axis (screen coords -> math coords)
    2. Estimate and optionally correct slant
    3. Scale uniformly based on canvas x-height reference (not per-char bbox)
    4. Shift so baseline is at y=0 and leftmost point is at x=0
    5. Compute metrics
    """
    # Convert to our Stroke type and flip y, preserving pressure if present
    strokes: list[Stroke] = []
    for raw_stroke in raw_strokes:
        stroke = []
        for pt in raw_stroke:
            pressure = pt[2] if len(pt) > 2 else 0.5
            stroke.append((pt[0], -pt[1], pressure))
        strokes.append(stroke)

    # Estimate slant (uses only x, y)
    slant = _estimate_slant(strokes)

    # Optionally correct slant
    if correct_slant and abs(slant) > 0.05:
        corrected: list[Stroke] = []
        for stroke in strokes:
            corrected.append([(x - y * math.tan(slant), y, p) for x, y, p in stroke])
        strokes = corrected

    # Scale relative to the canvas x-height zone.
    # The x-height zone is CANVAS_XHEIGHT_PX pixels in raw screen coords.
    # We map that to target_height (default 1.0) in normalized coords.
    # Every character uses the same scale factor, so proportions are preserved.
    scale = target_height / CANVAS_XHEIGHT_PX

    # Shift left edge to x=0
    min_x = min(x for stroke in strokes for x, y, p in stroke)
    strokes = [[((x - min_x) * scale, y * scale, p) for x, y, p in stroke] for stroke in strokes]

    # Place baseline at y=0.
    # In screen coords baseline was at CANVAS_BASELINE_Y (y-down).
    # After flip it's at -CANVAS_BASELINE_Y. After scaling: -CANVAS_BASELINE_Y * scale.
    baseline_y = -CANVAS_BASELINE_Y * scale
    strokes = [[(x, y - baseline_y, p) for x, y, p in stroke] for stroke in strokes]

    # Compute metrics from the actual normalized strokes
    min_x2, min_y2, max_x2, max_y2 = _bounding_box(strokes)
    width = max_x2 - min_x2
    height = max_y2 - min_y2

    # Compute bearings (small fixed fraction of width for MVP)
    bearing = max(width * 0.05, 0.01)

    return CharacterSample(
        char=char,
        strokes=strokes,
        width=width,
        height=height,
        baseline_offset=0.0,
        left_bearing=bearing,
        right_bearing=bearing,
        slant=slant,
        source_id=source_id,
        tags=[],
        is_synthetic=False,
    )


# --- I/O ---

def load_raw_samples(path: Path) -> list[tuple[str, list[list[list[float]]], str, str | None]]:
    """Load raw samples from a file or directory.

    Returns list of (char, strokes, source_id, tag) tuples.
    tag is None for untagged (text) samples, or "mathvar"/"mathdelim" etc.
    """
    path = Path(path)
    samples = []

    def _extract(entry, fallback_id):
        samples.append((
            entry["char"],
            entry["strokes"],
            entry.get("source_id", fallback_id),
            entry.get("tag", None),
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
    correct_slant: bool = False,
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

    for char, strokes, source_id, tag in raw_samples:
        error = validate_raw_sample(char, strokes)
        if error:
            print(f"  REJECT [{char}] {source_id}: {error}")
            rejected_count += 1
            continue

        sample = normalize_sample(char, strokes, source_id, correct_slant=correct_slant)
        if tag:
            sample.tags = [tag]
        processed_by_key.setdefault((tag, char), []).append(sample.to_dict())
        processed_count += 1

    # Save one JSON file per (tag, character)
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

    return processed_count, rejected_count


def main():
    parser = argparse.ArgumentParser(description="Preprocess raw handwriting samples")
    parser.add_argument("input", type=Path, help="Raw samples file or directory")
    parser.add_argument("output", type=Path, help="Output directory for processed samples")
    parser.add_argument("--correct-slant", action="store_true", help="Correct detected slant")
    args = parser.parse_args()

    print(f"Loading raw samples from {args.input}...")
    processed, rejected = preprocess_all(args.input, args.output, args.correct_slant)
    print(f"Done: {processed} processed, {rejected} rejected")
    print(f"Output saved to {args.output}/")


if __name__ == "__main__":
    main()
