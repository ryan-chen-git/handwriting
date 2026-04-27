#!/usr/bin/env python3
"""Pull collected handwriting samples from the Vercel-deployed collection app.

Usage:
    python scripts/pull_samples.py
    python scripts/pull_samples.py --url https://collect-app-ten.vercel.app
    python scripts/pull_samples.py --output data/raw_samples/
"""

import argparse
import json
import sys
from pathlib import Path
from urllib.request import urlopen, Request

DEFAULT_URL = "https://collect-app-ten.vercel.app"
DEFAULT_OUTPUT = Path("data/raw_samples")


def pull_samples(base_url: str, output_dir: Path) -> int:
    """Pull all samples from the collection server and save locally.

    Returns the number of samples pulled.
    """
    export_url = f"{base_url}/api/export"
    print(f"Fetching samples from {export_url}...")

    req = Request(export_url)
    with urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())

    samples = data.get("samples", [])
    total = data.get("total", len(samples))

    if total == 0:
        print("No samples found on server.")
        return 0

    print(f"Got {total} samples.")

    # Save as the pipeline-ready format
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / "collected_samples.json"
    out_file.write_text(json.dumps({"samples": samples}, indent=2))
    print(f"Saved to {out_file}")

    # Print summary
    chars = {}
    for s in samples:
        c = s["char"]
        chars[c] = chars.get(c, 0) + 1

    print(f"\n{len(chars)} unique characters:")
    for c in sorted(chars.keys()):
        print(f"  '{c}': {chars[c]} samples")

    return total


def main():
    parser = argparse.ArgumentParser(description="Pull samples from collection server")
    parser.add_argument("--url", default=DEFAULT_URL, help="Collection app URL")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output directory")
    args = parser.parse_args()

    total = pull_samples(args.url, args.output)
    if total > 0:
        print(f"\nDone. Run the pipeline:")
        print(f"  python scripts/preprocess.py {args.output} data/processed/")
        print(f"  python scripts/build_variants.py data/processed/ data/variant_library/")


if __name__ == "__main__":
    main()
