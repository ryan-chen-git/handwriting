#!/usr/bin/env python3
"""Build variant library from processed character samples.

Takes processed samples (output of preprocess.py) and generates synthetic
variants through interpolation and controlled perturbation.

Usage:
    python scripts/build_variants.py data/processed/ data/variant_library/
    python scripts/build_variants.py data/processed/ data/variant_library/ --target-per-char 30
"""

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from renderer.glyph_model import CharacterSample, Stroke, VariantLibrary


def interpolate_strokes(
    strokes_a: list[Stroke],
    strokes_b: list[Stroke],
    t: float,
) -> list[Stroke] | None:
    """Interpolate between two stroke sets at parameter t (0=a, 1=b).

    Returns None if the stroke structures are incompatible (different stroke count
    or very different point counts).
    """
    if len(strokes_a) != len(strokes_b):
        return None

    result: list[Stroke] = []
    for sa, sb in zip(strokes_a, strokes_b):
        # Allow small differences in point count by resampling the shorter one
        if len(sa) != len(sb):
            ratio = len(sa) / len(sb)
            if ratio < 0.5 or ratio > 2.0:
                return None  # too different
            # Resample to match the longer
            target_len = max(len(sa), len(sb))
            sa = _resample_stroke(sa, target_len)
            sb = _resample_stroke(sb, target_len)

        interpolated = [
            (a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t)
            for a, b in zip(sa, sb)
        ]
        result.append(interpolated)
    return result


def _resample_stroke(stroke: Stroke, n: int) -> Stroke:
    """Resample a stroke to have exactly n points, preserving shape."""
    if len(stroke) <= 1 or n <= 1:
        return stroke[:n] if n <= len(stroke) else stroke + [stroke[-1]] * (n - len(stroke))

    # Compute cumulative arc length
    lengths = [0.0]
    for i in range(1, len(stroke)):
        dx = stroke[i][0] - stroke[i - 1][0]
        dy = stroke[i][1] - stroke[i - 1][1]
        lengths.append(lengths[-1] + (dx * dx + dy * dy) ** 0.5)

    total = lengths[-1]
    if total < 1e-10:
        return [stroke[0]] * n

    result: Stroke = []
    for j in range(n):
        target = (j / (n - 1)) * total
        # Find the segment containing this length
        for i in range(1, len(lengths)):
            if lengths[i] >= target:
                seg_len = lengths[i] - lengths[i - 1]
                if seg_len < 1e-10:
                    result.append(stroke[i])
                else:
                    frac = (target - lengths[i - 1]) / seg_len
                    x = stroke[i - 1][0] + frac * (stroke[i][0] - stroke[i - 1][0])
                    y = stroke[i - 1][1] + frac * (stroke[i][1] - stroke[i - 1][1])
                    result.append((x, y))
                break
        else:
            result.append(stroke[-1])
    return result


def perturb_strokes(
    strokes: list[Stroke],
    rng: random.Random,
    scale: float = 0.03,
) -> list[Stroke]:
    """Apply small random perturbations to stroke points.

    Scale is relative to the sample's bounding box size.
    """
    # Find bounding box for scale reference
    all_pts = [pt for stroke in strokes for pt in stroke]
    if not all_pts:
        return strokes
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    bbox_size = max(max(xs) - min(xs), max(ys) - min(ys), 0.01)
    noise_mag = bbox_size * scale

    result: list[Stroke] = []
    for stroke in strokes:
        perturbed = []
        for i, (x, y) in enumerate(stroke):
            # Less perturbation at endpoints to preserve connections
            endpoint_factor = 1.0
            if i == 0 or i == len(stroke) - 1:
                endpoint_factor = 0.3
            dx = rng.gauss(0, noise_mag * endpoint_factor)
            dy = rng.gauss(0, noise_mag * endpoint_factor)
            perturbed.append((x + dx, y + dy))
        result.append(perturbed)
    return result


def generate_variants(
    real_samples: list[CharacterSample],
    target_count: int,
    rng: random.Random,
) -> list[CharacterSample]:
    """Generate synthetic variants from real samples to reach target_count total.

    Strategy:
    1. Try interpolation between structurally compatible pairs
    2. Fill remaining with perturbation of existing samples
    """
    if len(real_samples) == 0:
        return []

    needed = max(0, target_count - len(real_samples))
    if needed == 0:
        return []

    char = real_samples[0].char
    synthetic: list[CharacterSample] = []

    # Phase 1: Interpolation between compatible pairs
    if len(real_samples) >= 2:
        pairs = []
        for i in range(len(real_samples)):
            for j in range(i + 1, len(real_samples)):
                if len(real_samples[i].strokes) == len(real_samples[j].strokes):
                    pairs.append((i, j))

        rng.shuffle(pairs)
        interp_id = 0
        for i, j in pairs:
            if len(synthetic) >= needed:
                break
            sa, sb = real_samples[i], real_samples[j]
            # Generate 2-3 interpolations per pair
            for t in [0.3, 0.5, 0.7]:
                if len(synthetic) >= needed:
                    break
                result = interpolate_strokes(sa.strokes, sb.strokes, t)
                if result is None:
                    continue
                # Also apply light perturbation to the interpolation
                result = perturb_strokes(result, rng, scale=0.015)
                # Interpolate metrics too
                new_sample = CharacterSample(
                    char=char,
                    strokes=result,
                    width=sa.width * (1 - t) + sb.width * t,
                    height=sa.height * (1 - t) + sb.height * t,
                    baseline_offset=sa.baseline_offset * (1 - t) + sb.baseline_offset * t,
                    left_bearing=sa.left_bearing * (1 - t) + sb.left_bearing * t,
                    right_bearing=sa.right_bearing * (1 - t) + sb.right_bearing * t,
                    slant=sa.slant * (1 - t) + sb.slant * t,
                    source_id=f"interp_{sa.source_id}_{sb.source_id}_{interp_id}",
                    tags=[],
                    is_synthetic=True,
                )
                synthetic.append(new_sample)
                interp_id += 1

    # Phase 2: Perturbation of existing samples (real + already-generated)
    all_available = real_samples + synthetic
    perturb_id = 0
    while len(synthetic) < needed:
        base = rng.choice(all_available)
        perturbed = perturb_strokes(base.strokes, rng, scale=0.03)
        new_sample = CharacterSample(
            char=char,
            strokes=perturbed,
            width=base.width * (1 + rng.gauss(0, 0.02)),
            height=base.height,
            baseline_offset=base.baseline_offset + rng.gauss(0, 0.01),
            left_bearing=base.left_bearing,
            right_bearing=base.right_bearing,
            slant=base.slant + rng.gauss(0, 0.02),
            source_id=f"perturb_{base.source_id}_{perturb_id}",
            tags=[],
            is_synthetic=True,
        )
        synthetic.append(new_sample)
        perturb_id += 1

    return synthetic


def build_library(
    processed_dir: Path,
    output_dir: Path,
    target_per_char: int = 30,
    seed: int = 42,
) -> VariantLibrary:
    """Build a complete variant library from processed samples."""
    processed_dir = Path(processed_dir)
    rng = random.Random(seed)
    library = VariantLibrary()

    for f in sorted(processed_dir.glob("*.json")):
        data = json.loads(f.read_text())
        char = data["char"]
        tag = data.get("tag", None)
        real_samples = [CharacterSample.from_dict(v) for v in data["variants"]]

        # Add real samples only
        for s in real_samples:
            # Ensure tag is set on the sample
            if tag and tag not in s.tags:
                s.tags = [tag]
            library.add(s)

        tag_label = f" [{tag}]" if tag else ""
        print(f"  '{char}'{tag_label}: {len(real_samples)} samples")

    library.save(output_dir)
    return library


def main():
    parser = argparse.ArgumentParser(description="Build variant library from processed samples")
    parser.add_argument("input", type=Path, help="Processed samples directory")
    parser.add_argument("output", type=Path, help="Output variant library directory")
    parser.add_argument("--target-per-char", type=int, default=30, help="Target variants per character")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    print(f"Building variant library from {args.input}...")
    library = build_library(args.input, args.output, args.target_per_char, args.seed)
    print(f"\n{library.summary()}")


if __name__ == "__main__":
    main()
