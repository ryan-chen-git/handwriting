#!/bin/bash
# Handwriting Test Compile — macOS launcher (double-clickable).
# macOS opens .command files in Terminal, which is fine — errors and
# logs are visible there.
#
# On first run, creates venv/ and installs requirements.txt. Subsequent
# runs reuse the existing venv. To force a clean rebuild, delete venv/.

set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Could not find python3. Install via: brew install python"
    read -p "Press Return to close."
    exit 1
fi

if [ ! -x venv/bin/python ]; then
    echo "Setting up Python venv (first run only)…"
    python3 -m venv venv
    venv/bin/pip install --upgrade pip --quiet
    venv/bin/pip install -r requirements.txt --quiet
fi

exec venv/bin/python scripts/compile_server.py
