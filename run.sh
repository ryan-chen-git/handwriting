#!/bin/bash
# Handwriting Test Compile — Linux launcher.

cd "$(dirname "$0")"

if [ -x venv/bin/python ]; then
    exec venv/bin/python scripts/compile_server.py
elif command -v python3 >/dev/null 2>&1; then
    exec python3 scripts/compile_server.py
else
    echo "Could not find Python 3. Install via your package manager."
    exit 1
fi
