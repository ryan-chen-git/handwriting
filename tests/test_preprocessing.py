"""Tests for the preprocessing pipeline."""

import json
import tempfile
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.preprocess import (
    validate_raw_sample,
    normalize_sample,
    load_raw_samples,
    preprocess_all,
)
from renderer.glyph_model import CharacterSample


def _make_square_strokes():
    """A simple square shape for testing."""
    return [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]


def _make_letter_a_strokes():
    """Rough 'a' shape: circle + stem."""
    circle = [
        [50, 20], [30, 10], [15, 20], [10, 40], [15, 60],
        [30, 70], [50, 60], [50, 40], [50, 20],
    ]
    stem = [[50, 20], [50, 70]]
    return [circle, stem]


# --- Validation tests ---

def test_validate_valid_sample():
    assert validate_raw_sample("a", _make_square_strokes()) is None


def test_validate_empty_char():
    assert validate_raw_sample("", _make_square_strokes()) is not None


def test_validate_multi_char():
    assert validate_raw_sample("ab", _make_square_strokes()) is not None


def test_validate_too_few_points():
    assert validate_raw_sample("a", [[[0, 0]]]) is not None


def test_validate_no_strokes():
    assert validate_raw_sample("a", []) is not None


def test_validate_nan_coords():
    assert validate_raw_sample("a", [[[float("nan"), 0], [1, 1]]]) is not None


def test_validate_rejects_out_of_canvas():
    canvas = {"width": 320, "height": 160, "baseline_y": 112, "xheight_y": 64}
    # x=5000 is way past width=320 even with 5% tolerance
    err = validate_raw_sample("a", [[[10, 10], [5000, 10]]], canvas)
    assert err is not None
    assert "outside canvas" in err


def test_validate_allows_small_overshoot():
    canvas = {"width": 320, "height": 160, "baseline_y": 112, "xheight_y": 64}
    # 322 is just past the edge — within 5% tolerance
    assert validate_raw_sample("a", [[[10, 10], [322, 10]]], canvas) is None


# --- Normalization tests ---

def test_normalize_basic():
    sample = normalize_sample("a", _make_letter_a_strokes(), source_id="test")
    assert sample.char == "a"
    assert sample.width > 0
    assert sample.height > 0
    assert sample.source_id == "test"
    assert sample.has_pressure is False  # 2D points only


def test_normalize_detects_pressure():
    strokes_with_p = [[[10, 10, 0.4], [50, 10, 0.8], [50, 50, 0.5]]]
    sample = normalize_sample("a", strokes_with_p, source_id="p")
    assert sample.has_pressure is True
    assert all(len(pt) == 3 for stroke in sample.strokes for pt in stroke)


def test_normalize_uses_provided_canvas():
    # Same strokes, two canvas geometries: tall canvas should produce taller normalized height
    strokes = [[[10, 20], [10, 100]]]
    short = normalize_sample(
        "a", strokes, canvas={"width": 320, "height": 160, "baseline_y": 112, "xheight_y": 64}
    )
    tall = normalize_sample(
        "a", strokes, canvas={"width": 320, "height": 320, "baseline_y": 224, "xheight_y": 128}
    )
    # x-height zone differs (48 vs 96 px), so the same 80-px stroke renders to a different height
    assert short.height != tall.height


def test_normalize_serialization_roundtrip():
    sample = normalize_sample("a", _make_letter_a_strokes(), source_id="rt")
    d = sample.to_dict()
    restored = CharacterSample.from_dict(d)
    assert restored.char == sample.char
    assert len(restored.strokes) == len(sample.strokes)
    assert restored.source_id == sample.source_id
    assert restored.has_pressure == sample.has_pressure


# --- I/O tests ---

def test_load_single_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        data = {
            "samples": [
                {"char": "a", "strokes": _make_letter_a_strokes(), "source_id": "s1"},
                {"char": "b", "strokes": _make_square_strokes(), "source_id": "s2"},
            ]
        }
        path = Path(tmpdir) / "samples.json"
        path.write_text(json.dumps(data))

        samples = load_raw_samples(path)
        assert len(samples) == 2
        assert samples[0][0] == "a"
        assert samples[1][0] == "b"


def test_load_directory():
    with tempfile.TemporaryDirectory() as tmpdir:
        for char in ["a", "b"]:
            data = {"char": char, "strokes": _make_square_strokes()}
            (Path(tmpdir) / f"{char}.json").write_text(json.dumps(data))

        samples = load_raw_samples(Path(tmpdir))
        assert len(samples) == 2


def test_preprocess_all_end_to_end():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        raw_dir = tmpdir / "raw"
        out_dir = tmpdir / "processed"
        raw_dir.mkdir()

        data = {
            "samples": [
                {"char": "a", "strokes": _make_letter_a_strokes()},
                {"char": "a", "strokes": _make_square_strokes()},
                {"char": "b", "strokes": _make_square_strokes()},
            ]
        }
        (raw_dir / "samples.json").write_text(json.dumps(data))

        processed, rejected = preprocess_all(raw_dir, out_dir)
        assert processed == 3
        assert rejected == 0
        assert (out_dir / "a.json").exists()
        assert (out_dir / "b.json").exists()

        # Verify output format
        a_data = json.loads((out_dir / "a.json").read_text())
        assert a_data["char"] == "a"
        assert len(a_data["variants"]) == 2


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
