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

    Strokes are stored as lists of (x, y) or (x, y, pressure) point sequences.
    Coordinates are in a normalized space after preprocessing:
    - x: 0 is leftmost point, width is rightmost
    - y: 0 is baseline, positive is up (ascender direction), negative is down (descender)

    has_pressure indicates whether the source data carried real stylus pressure.
    The font builder uses it to decide between pressure-driven and
    velocity-only stroke-width modulation, so mixed-source libraries don't
    silently produce inconsistent line weights.
    """
    char: str
    strokes: list[Stroke]
    width: float = 0.0
    height: float = 0.0
    source_id: str = ""
    tags: list[str] = field(default_factory=list)
    has_pressure: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "char": self.char,
            "strokes": [[pt for pt in stroke] for stroke in self.strokes],
            "width": self.width,
            "height": self.height,
            "source_id": self.source_id,
            "tags": self.tags,
            "has_pressure": self.has_pressure,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> CharacterSample:
        return cls(
            char=d["char"],
            strokes=[[tuple(pt) for pt in stroke] for stroke in d["strokes"]],
            width=d.get("width", 0.0),
            height=d.get("height", 0.0),
            source_id=d.get("source_id", ""),
            tags=d.get("tags", []),
            has_pressure=d.get("has_pressure", False),
        )


class SampleLibrary:
    """Collection of normalized character samples, keyed by (tag, char).

    Untagged samples (regular text glyphs) use tag=None. Tags such as
    "mathvar" or "mathdelim" carry alternate-form samples for math contexts.
    """

    def __init__(self) -> None:
        self.samples: dict[tuple[str | None, str], list[CharacterSample]] = {}

    def add(self, sample: CharacterSample) -> None:
        tag = sample.tags[0] if sample.tags else None
        self.samples.setdefault((tag, sample.char), []).append(sample)

    def get(self, char: str, tag: str | None = None) -> list[CharacterSample]:
        return self.samples.get((tag, char), [])

    def chars(self, tag: str | None = None) -> list[str]:
        """Characters that have at least one sample with the given tag."""
        return sorted(c for (t, c) in self.samples if t == tag)

    def count(self, char: str | None = None, tag: str | None = None) -> int:
        if char is not None:
            return len(self.samples.get((tag, char), []))
        return sum(len(v) for v in self.samples.values())

    def save(self, path: Path) -> None:
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        for (tag, char), samples in self.samples.items():
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
    def load(cls, path: Path) -> SampleLibrary:
        lib = cls()
        path = Path(path)
        for f in sorted(path.glob("*.json")):
            data = json.loads(f.read_text())
            for variant_dict in data["variants"]:
                lib.add(CharacterSample.from_dict(variant_dict))
        return lib

    def summary(self) -> str:
        lines = [f"SampleLibrary: {self.count()} total samples across {len(self.samples)} (tag,char) keys"]
        for (tag, char), samples in sorted(self.samples.items(), key=lambda kv: (kv[0][0] or "", kv[0][1])):
            tag_label = f" [{tag}]" if tag else ""
            lines.append(f"  '{char}'{tag_label}: {len(samples)} samples")
        return "\n".join(lines)


def _safe_filename(char: str) -> str:
    """Convert a character to a safe filename."""
    if char.isalnum():
        if char.isupper():
            return f"upper_{char}"
        return char
    # Use Unicode codepoint for special characters
    return f"u{ord(char):04x}"
