#!/bin/bash
# Handwriting Test Compile — macOS launcher (double-clickable).
# macOS opens .command files in Terminal, which is fine — errors and
# logs are visible there.

cd "$(dirname "$0")"

if [ -x venv/bin/python ]; then
    exec venv/bin/python scripts/compile_server.py
elif command -v python3 >/dev/null 2>&1; then
    exec python3 scripts/compile_server.py
else
    echo "Could not find Python 3. Install via: brew install python"
    read -p "Press Return to close."
    exit 1
fi
