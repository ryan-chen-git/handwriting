"""Core data structures for the handwriting renderer."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# Each point is (x, y) or (x, y, pressure). Pressure is 0.0-1.0.
Point = tuple[float, ...]
Stroke = list[Point]


@dataclass
class CharacterSample:
    """A single handwriting sample for one character.

    Strokes are stored as lists of (x, y) point sequences.
    Coordinates are in a normalized space after preprocessing:
    - x: 0 is leftmost point, width is rightmost
    - y: 0 is baseline, positive is up (ascender direction), negative is down (descender)
    """
    char: str
    strokes: list[Stroke]
    width: float = 0.0
    height: float = 0.0
    baseline_offset: float = 0.0
    left_bearing: float = 0.0
    right_bearing: float = 0.0
    slant: float = 0.0
    source_id: str = ""
    tags: list[str] = field(default_factory=list)
    # Set during variant generation to distinguish real vs synthetic
    is_synthetic: bool = False

    @property
    def advance_width(self) -> float:
        """Total horizontal space this glyph occupies (bearing + width + bearing)."""
        return self.left_bearing + self.width + self.right_bearing

    def to_dict(self) -> dict[str, Any]:
        return {
            "char": self.char,
            "strokes": [[pt for pt in stroke] for stroke in self.strokes],
            "width": self.width,
            "height": self.height,
            "baseline_offset": self.baseline_offset,
            "left_bearing": self.left_bearing,
            "right_bearing": self.right_bearing,
            "slant": self.slant,
            "source_id": self.source_id,
            "tags": self.tags,
            "is_synthetic": self.is_synthetic,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> CharacterSample:
        return cls(
            char=d["char"],
            strokes=[[tuple(pt) for pt in stroke] for stroke in d["strokes"]],
            width=d.get("width", 0.0),
            height=d.get("height", 0.0),
            baseline_offset=d.get("baseline_offset", 0.0),
            left_bearing=d.get("left_bearing", 0.0),
            right_bearing=d.get("right_bearing", 0.0),
            slant=d.get("slant", 0.0),
            source_id=d.get("source_id", ""),
            tags=d.get("tags", []),
            is_synthetic=d.get("is_synthetic", False),
        )


class VariantLibrary:
    """Collection of character variants, both real and generated.

    Samples are keyed by (tag, char) internally. Untagged samples use tag=None.
    The key is stored as "tag:char" for tagged or just "char" for untagged.
    """

    def __init__(self) -> None:
        self.samples: dict[str, list[CharacterSample]] = {}

    _SEP = "\x00"  # null byte separator — won't appear in real chars or tags

    @staticmethod
    def _key(char: str, tag: str | None = None) -> str:
        return f"{tag}{VariantLibrary._SEP}{char}" if tag else char

    @staticmethod
    def _parse_key(key: str) -> tuple[str | None, str]:
        if VariantLibrary._SEP in key:
            tag, char = key.split(VariantLibrary._SEP, 1)
            return tag, char
        return None, key

    def add(self, sample: CharacterSample) -> None:
        tag = sample.tags[0] if sample.tags else None
        key = self._key(sample.char, tag)
        self.samples.setdefault(key, []).append(sample)

    def get_variants(self, char: str, tag: str | None = None) -> list[CharacterSample]:
        return self.samples.get(self._key(char, tag), [])

    def keys(self) -> list[str]:
        """Return all storage keys sorted."""
        return sorted(self.samples.keys())

    def chars(self) -> list[str]:
        """Return unique characters (untagged only, for backward compat)."""
        result = set()
        for key in self.samples:
            tag, char = self._parse_key(key)
            if tag is None:
                result.add(char)
        return sorted(result)

    def tagged_chars(self, tag: str) -> list[str]:
        """Return characters that have the given tag."""
        result = set()
        for key in self.samples:
            t, char = self._parse_key(key)
            if t == tag:
                result.add(char)
        return sorted(result)

    def count(self, char: str | None = None) -> int:
        if char is not None:
            return len(self.samples.get(char, []))
        return sum(len(v) for v in self.samples.values())

    def save(self, path: Path) -> None:
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        for key, samples in self.samples.items():
            tag, char = self._parse_key(key)
            safe_name = _safe_filename(char)
            if tag:
                safe_name = f"{tag}_{safe_name}"
            char_file = path / f"{safe_name}.json"
            data = {
                "char": char,
                "tag": tag,
                "variants": [s.to_dict() for s in samples],
            }
            char_file.write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: Path) -> VariantLibrary:
        lib = cls()
        path = Path(path)
        for f in sorted(path.glob("*.json")):
            data = json.loads(f.read_text())
            for variant_dict in data["variants"]:
                lib.add(CharacterSample.from_dict(variant_dict))
        return lib

    def summary(self) -> str:
        lines = [f"VariantLibrary: {self.count()} total variants across {len(self.samples)} keys"]
        for key in self.keys():
            tag, char = self._parse_key(key)
            variants = self.samples[key]
            real = sum(1 for v in variants if not v.is_synthetic)
            synth = sum(1 for v in variants if v.is_synthetic)
            tag_label = f" [{tag}]" if tag else ""
            lines.append(f"  '{char}'{tag_label}: {real} real + {synth} synthetic = {len(variants)} total")
        return "\n".join(lines)


def _safe_filename(char: str) -> str:
    """Convert a character to a safe filename."""
    if char.isalnum():
        if char.isupper():
            return f"upper_{char}"
        return char
    # Use Unicode codepoint for special characters
    return f"u{ord(char):04x}"
