#!/bin/bash
# Handwriting Test Compile — Linux launcher.
#
# On first run, creates venv/ and installs requirements.txt. Subsequent
# runs reuse the existing venv. To force a clean rebuild, delete venv/.

set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Could not find python3. Install via your package manager (e.g. apt install python3 python3-venv)."
    exit 1
fi

if [ ! -x venv/bin/python ]; then
    echo "Setting up Python venv (first run only)…"
    python3 -m venv venv
    venv/bin/pip install --upgrade pip --quiet
    venv/bin/pip install -r requirements.txt --quiet
fi

exec venv/bin/python scripts/compile_server.py
