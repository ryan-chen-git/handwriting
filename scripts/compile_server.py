#!/usr/bin/env python3
r"""Local HTTP server that serves the Test Compile UI and compiles LaTeX
with your handwriting font.

Run from the repo root — the browser opens automatically:

    python scripts/compile_server.py

Flags:
    --port 8787    change port (default 8787)
    --host         bind address (default 127.0.0.1)
    --no-open      don't open a browser window on start

Endpoints:
    GET  /            Test Compile HTML page
    GET  /health      {ok, font_exists, lualatex}
    GET  /chars       {chars, counts, mtime}
    GET  /default_template  {latex}  (seed for the editor — no font code)
    POST /compile     {latex, rebuild, skip_pull}
                      -> {ok, pdf(base64), log, stage}
                      Any font-selection lines in `latex` are stripped and
                      the handwriting fontspec is injected right before
                      \begin{document}.
"""

import argparse
import base64
import importlib.util
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FONT_OUT = REPO_ROOT / "outputs" / "HandwritingFont.otf"
STATIC_DIR = Path(__file__).resolve().parent / "static"
RAW_SAMPLES_FILE = REPO_ROOT / "data" / "raw_samples" / "collected_samples.json"

# Forward slashes so LaTeX doesn't interpret Windows backslashes as escapes.
_FONT_DIR = REPO_ROOT.joinpath("outputs").as_posix()

# Font preamble injected into every compile right before \begin{document}.
# Any font-altering lines the user wrote are stripped first (see
# normalize_font_preamble), so this always wins.
FONT_INJECT = rf"""% --- injected handwriting font preamble ---
\usepackage{{fontspec}}
\usepackage{{unicode-math}}
\setmainfont{{HandwritingFont.otf}}[Path={_FONT_DIR}/]
\setmathfont{{HandwritingFont.otf}}[Path={_FONT_DIR}/]
\setmathfont{{latinmodern-math.otf}}[range={{"2A00-"2AFF,"27C0-"27EF,cal,frak,bb,scr}}]
% --- end injected ---
"""

# Lines that select or load fonts. Anything matching is dropped from the
# user's source before we inject our own preamble, so users never need to
# add font code themselves and any font they did specify is overridden.
FONT_LINE_PATTERNS = [
    re.compile(r"^\s*\\usepackage(\[[^\]]*\])?\{(fontspec|unicode-math|mathspec)\}\s*$"),
    re.compile(r"^\s*\\(setmainfont|setmathfont|setsansfont|setmonofont)\{[^}]*\}(\[[^\]]*\])?\s*$"),
]


def normalize_font_preamble(src: str) -> tuple[str, list[str], int]:
    """Strip user-supplied font-selection lines, then inject FONT_INJECT.

    Returns (final_source, stripped_lines, marker_index). Stripped lines
    and the byte offset of \\begin{document} are returned for logging.
    If \\begin{document} is absent we still drop the font lines but skip
    injection — lualatex will raise a clear error for the missing
    document environment.
    """
    kept: list[str] = []
    stripped: list[str] = []
    for ln in src.split("\n"):
        if any(p.match(ln) for p in FONT_LINE_PATTERNS):
            stripped.append(ln)
        else:
            kept.append(ln)
    body = "\n".join(kept)
    marker = r"\begin{document}"
    idx = body.find(marker)
    if idx < 0:
        return body, stripped, -1
    return body[:idx] + FONT_INJECT + body[idx:], stripped, idx


# Clean Overleaf "blank project" — no font code in the editor. The backend
# adds the handwriting fontspec at compile time.
DEFAULT_TEMPLATE = r"""\documentclass{article}

\title{Handwriting Test Compile}
\author{}
\date{}

\begin{document}
\maketitle

Hello, world.

\[ E = mc^2 \]

\end{document}
"""

PY = sys.executable or "python3"

# On Windows, suppress the empty console windows that would otherwise flash
# open for every subprocess (each build step + lualatex).
_SUBPROCESS_KW = {}
if sys.platform == "win32":
    _SUBPROCESS_KW["creationflags"] = subprocess.CREATE_NO_WINDOW


def resolve_lualatex():
    """Find the lualatex binary. Falls back to common install dirs on
    Windows where PATH updates don't always reach subprocess environments."""
    found = shutil.which("lualatex")
    if found:
        return found
    candidates = []
    local = os.environ.get("LOCALAPPDATA")
    if local:
        candidates.append(Path(local) / "Programs" / "MiKTeX" / "miktex" / "bin" / "x64" / "lualatex.exe")
    pf = os.environ.get("ProgramFiles")
    if pf:
        candidates.append(Path(pf) / "MiKTeX" / "miktex" / "bin" / "x64" / "lualatex.exe")
    pfx86 = os.environ.get("ProgramFiles(x86)")
    if pfx86:
        candidates.append(Path(pfx86) / "MiKTeX" / "miktex" / "bin" / "x64" / "lualatex.exe")
    candidates += [
        Path(r"C:\texlive\2025\bin\windows\lualatex.exe"),
        Path(r"C:\texlive\2024\bin\windows\lualatex.exe"),
        Path(r"C:\texlive\2023\bin\win32\lualatex.exe"),
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None


LUALATEX = resolve_lualatex()

BUILD_STEPS = [
    [PY, "scripts/pull_samples.py"],
    [PY, "scripts/preprocess.py", "data/raw_samples/", "data/processed/"],
    [PY, "scripts/build_variants.py", "data/processed/", "data/variant_library/"],
    [PY, "scripts/build_font.py", "data/variant_library/", "outputs/HandwritingFont.otf"],
]


def run_capture(cmd, cwd):
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, **_SUBPROCESS_KW)
    return proc.returncode, proc.stdout, proc.stderr


def build_font(logs, skip_pull=False):
    steps = BUILD_STEPS[1:] if skip_pull else BUILD_STEPS
    for cmd in steps:
        logs.append(f"$ {' '.join(cmd)}")
        code, out, err = run_capture(cmd, REPO_ROOT)
        if out:
            logs.append(out)
        if err:
            logs.append(err)
        if code != 0:
            logs.append(f"[exit {code}] build step failed")
            return False
    return True


def _section(logs: list, title: str, body: str) -> None:
    """Emit a structured `=== SECTION: <title> ===` block.

    The frontend LogsPanel detects these markers and renders each block
    as a collapsible `<details>` so we can carry a lot of diagnostic
    context without overwhelming the default view.
    """
    logs.append(f"=== SECTION: {title} ===")
    logs.append(body if body else "(empty)")


def _numbered(src: str) -> str:
    lines = src.split("\n")
    width = len(str(len(lines)))
    return "\n".join(f"{str(i + 1).rjust(width)} | {ln}" for i, ln in enumerate(lines))


def compile_latex(latex_source, rebuild, skip_pull, logs):
    if rebuild or not FONT_OUT.exists():
        if not build_font(logs, skip_pull=skip_pull):
            return None
    else:
        logs.append(f"[skip rebuild] using existing {FONT_OUT}")

    if not LUALATEX:
        logs.append("[error] lualatex not found. Install a TeX distribution:")
        logs.append("  Windows:       winget install MiKTeX.MiKTeX")
        logs.append("  macOS:         brew install --cask mactex")
        logs.append("  Debian/Ubuntu: sudo apt install texlive-luatex texlive-latex-extra texlive-fonts-extra texlive-science")
        return None

    # --- Request summary -------------------------------------------------
    req_info = [
        f"source bytes: {len(latex_source)}",
        f"source lines: {latex_source.count(chr(10)) + 1}",
        f"has \\documentclass: {'yes' if '\\documentclass' in latex_source else 'NO'}",
        f"has \\begin{{document}}: {'yes' if '\\begin{document}' in latex_source else 'NO'}",
        f"has \\end{{document}}: {'yes' if '\\end{document}' in latex_source else 'NO'}",
        "",
        "first 300 chars:",
        latex_source[:300],
    ]
    _section(logs, "request", "\n".join(req_info))

    # --- Font environment -----------------------------------------------
    font_info = [f"font directory (Path=): {_FONT_DIR}/"]
    if FONT_OUT.exists():
        try:
            st = FONT_OUT.stat()
            font_info.append(f"HandwritingFont.otf: exists ({st.st_size} bytes)")
        except OSError as e:
            font_info.append(f"HandwritingFont.otf: stat failed: {e}")
    else:
        font_info.append(f"HandwritingFont.otf: MISSING at {FONT_OUT}")
        font_info.append("  (handwriting font won't apply; lualatex may still succeed")
        font_info.append("   with a fallback font, which is almost certainly the bug)")
    try:
        outputs_listing = sorted(p.name for p in Path(_FONT_DIR).iterdir())
        font_info.append(f"outputs/ contents: {outputs_listing}")
    except OSError as e:
        font_info.append(f"outputs/ listing failed: {e}")
    _section(logs, "font environment", "\n".join(font_info))

    # --- Normalize -------------------------------------------------------
    final_tex, stripped, marker_idx = normalize_font_preamble(latex_source)
    norm_info = [
        f"lines stripped: {len(stripped)}",
    ]
    if stripped:
        norm_info.append("stripped lines:")
        norm_info.extend(f"  - {ln}" for ln in stripped)
    norm_info.append(
        f"\\begin{{document}} byte offset after stripping: {marker_idx}"
        + (" (NOT FOUND — injection skipped)" if marker_idx < 0 else " (font block injected here)")
    )
    _section(logs, "normalize", "\n".join(norm_info))

    # --- Final doc.tex ---------------------------------------------------
    _section(logs, "final doc.tex (what lualatex will see)", _numbered(final_tex))

    tmp = Path(tempfile.mkdtemp(prefix="hwcompile-"))
    try:
        tex_path = tmp / "doc.tex"
        tex_path.write_text(final_tex, encoding="utf-8")

        cmd = [
            LUALATEX,
            "-interaction=nonstopmode",
            "-halt-on-error",
            f"-output-directory={tmp}",
            str(tex_path),
        ]
        _section(logs, "lualatex invocation", "$ " + " ".join(cmd))
        code, out, err = run_capture(cmd, tmp)

        # Pull the critical diagnostics out of the lualatex .log file —
        # that's where fontspec reports which font it actually loaded.
        log_path = tmp / "doc.log"
        fontspec_lines: list[str] = []
        if log_path.exists():
            try:
                log_text = log_path.read_text(encoding="utf-8", errors="replace")
                for ln in log_text.split("\n"):
                    low = ln.lower()
                    if any(
                        needle in low
                        for needle in (
                            "fontspec",
                            "handwritingfont",
                            "latinmodern",
                            "setmainfont",
                            "setmathfont",
                            "cannot find",
                            "! ",
                            "no file",
                            "font ",
                        )
                    ):
                        fontspec_lines.append(ln)
            except OSError as e:
                fontspec_lines.append(f"[read doc.log failed: {e}]")
        if fontspec_lines:
            _section(
                logs,
                "fontspec / error lines from doc.log",
                "\n".join(fontspec_lines[-200:]),
            )

        _section(logs, f"lualatex stdout (exit {code}, last 4000 chars)", (out or "")[-4000:])
        if err:
            _section(logs, "lualatex stderr (last 2000 chars)", err[-2000:])

        # --- Artifacts --------------------------------------------------
        pdf_path = tmp / "doc.pdf"
        artifact_lines = []
        try:
            for p in sorted(tmp.iterdir()):
                try:
                    artifact_lines.append(f"{p.name}  ({p.stat().st_size} bytes)")
                except OSError:
                    artifact_lines.append(p.name)
        except OSError as e:
            artifact_lines.append(f"tmp listing failed: {e}")
        _section(logs, "artifacts (build dir)", "\n".join(artifact_lines))

        if not pdf_path.exists():
            logs.append(f"[exit {code}] lualatex produced no pdf")
            return None
        return pdf_path.read_bytes()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def read_collected_chars():
    """Returns (chars_list, counts_dict, source_mtime) from the locally
    cached samples, or empty if no pull has happened yet."""
    if not RAW_SAMPLES_FILE.exists():
        return [], {}, 0
    try:
        data = json.loads(RAW_SAMPLES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return [], {}, 0
    counts = {}
    for s in data.get("samples", []):
        c = s.get("char")
        if not c:
            continue
        counts[c] = counts.get(c, 0) + 1
    chars = sorted(counts.keys())
    mtime = int(RAW_SAMPLES_FILE.stat().st_mtime)
    return chars, counts, mtime


class Handler(BaseHTTPRequestHandler):
    server_version = "HandwritingCompile/1.2"

    def _send(self, status, body, content_type):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, payload):
        self._send(status, json.dumps(payload), "application/json")

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            if PREFLIGHT_PROBLEMS:
                self._send(503, _preflight_html(PREFLIGHT_PROBLEMS),
                           "text/html; charset=utf-8")
                return
            page = STATIC_DIR / "dist" / "index.html"
            if not page.exists():
                msg = ("Built UI missing. Run:\n"
                       "  cd scripts/static && npm install && npm run build")
                self._send(500, msg, "text/plain; charset=utf-8")
                return
            self._send(200, page.read_bytes(), "text/html; charset=utf-8")
            return
        if self.path == "/health":
            self._json(200, {
                "ok": True,
                "font_exists": FONT_OUT.exists(),
                "lualatex": LUALATEX,
            })
            return
        if self.path == "/chars":
            chars, counts, mtime = read_collected_chars()
            self._json(200, {"chars": chars, "counts": counts, "mtime": mtime})
            return
        if self.path == "/default_template":
            self._json(200, {"latex": DEFAULT_TEMPLATE})
            return
        # Serve Vite build assets (anything under /assets/, plus root files like
        # favicon.ico). Constrain to dist/ to avoid path traversal.
        if self.path.startswith("/assets/") or self.path in (
            "/favicon.ico", "/favicon.svg", "/robots.txt", "/manifest.webmanifest",
        ):
            rel = self.path.lstrip("/")
            target = (STATIC_DIR / "dist" / rel).resolve()
            dist_root = (STATIC_DIR / "dist").resolve()
            try:
                target.relative_to(dist_root)
            except ValueError:
                self._json(403, {"error": "forbidden"})
                return
            if not target.is_file():
                self._json(404, {"error": "not found"})
                return
            ctype, _ = mimetypes.guess_type(target.name)
            self._send(200, target.read_bytes(), ctype or "application/octet-stream")
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/compile":
            self._json(404, {"error": "not found"})
            return
        if PREFLIGHT_PROBLEMS:
            self._json(503, {"ok": False, "stage": "preflight",
                             "log": "\n".join(PREFLIGHT_PROBLEMS)})
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        try:
            req = json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:
            self._json(400, {"error": f"bad json: {e}"})
            return

        latex = req.get("latex")
        if not isinstance(latex, str) or not latex:
            self._json(400, {"error": "latex body required"})
            return
        rebuild = bool(req.get("rebuild", True))
        skip_pull = bool(req.get("skip_pull", False))

        logs = []
        try:
            pdf = compile_latex(latex, rebuild, skip_pull, logs)
        except Exception as e:
            logs.append(f"[exception] {e!r}")
            self._json(500, {"ok": False, "log": "\n".join(logs), "stage": "exception"})
            return
        if pdf is None:
            self._json(500, {"ok": False, "log": "\n".join(logs), "stage": "build_or_latex"})
            return
        self._json(200, {
            "ok": True,
            "pdf": base64.b64encode(pdf).decode("ascii"),
            "log": "\n".join(logs),
        })

    def log_message(self, fmt, *args):
        sys.stderr.write("[compile] " + fmt % args + "\n")


PREFLIGHT_PROBLEMS = []


def preflight():
    """Return a list of human-readable problems. Empty list means all good."""
    problems = []
    if importlib.util.find_spec("fontTools") is None:
        problems.append(
            "Python package 'fontTools' is not installed.\n"
            f"Install with:  {PY} -m pip install -r requirements.txt"
        )
    if LUALATEX is None:
        problems.append(
            "'lualatex' was not found on PATH or in common install locations.\n"
            "Install a TeX distribution:\n"
            "  Windows:       winget install MiKTeX.MiKTeX\n"
            "  macOS:         brew install --cask mactex\n"
            "  Debian/Ubuntu: sudo apt install texlive-luatex texlive-latex-extra \\\n"
            "                                 texlive-fonts-extra texlive-science\n"
            "Then open a fresh terminal so the new PATH is picked up."
        )
    return problems


def _preflight_html(problems):
    items = "".join(
        f"<li><pre>{p.replace('<', '&lt;').replace('>', '&gt;')}</pre></li>"
        for p in problems
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Handwriting — Setup incomplete</title>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; max-width: 760px;
         margin: 48px auto; padding: 0 20px; color: #1d1d1f; line-height: 1.5; }}
  h1 {{ font-size: 22px; margin-bottom: 8px; }}
  p  {{ color: #555; }}
  pre {{ background: #f5f5f7; padding: 12px 14px; border-radius: 8px;
         white-space: pre-wrap; font-size: 13px; font-family: ui-monospace, Menlo, monospace; }}
  li {{ margin-bottom: 18px; list-style: none; }}
  ul {{ padding-left: 0; }}
</style></head><body>
<h1>Setup incomplete</h1>
<p>The local Test Compile server is running but needs the following before it can compile:</p>
<ul>{items}</ul>
<p>Fix the above, then relaunch (double-click <code>run.bat</code> /
<code>run.command</code> / <code>run.sh</code> again, or rerun
<code>python scripts/compile_server.py</code>).</p>
</body></html>"""


def _show_fatal(title, message):
    """Best-effort visible error when stdout isn't a terminal."""
    sys.stderr.write(f"{title}: {message}\n")
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)
        except Exception:
            pass
    elif sys.platform == "darwin":
        try:
            subprocess.run([
                "osascript", "-e",
                f'display dialog "{message}" with title "{title}" with icon stop buttons {{"OK"}}'
            ], **_SUBPROCESS_KW)
        except Exception:
            pass


def _ensure_std_streams():
    """Under pythonw.exe on Windows, sys.stdout and sys.stderr can be None,
    which makes any print() or handler log_message() raise and tear down
    connections mid-request. Route them to devnull so writes silently succeed."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")


def main():
    global PREFLIGHT_PROBLEMS
    _ensure_std_streams()
    ap = argparse.ArgumentParser(description="Handwriting Test Compile server.")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--no-open", action="store_true",
                    help="don't open a browser window on start")
    args = ap.parse_args()

    PREFLIGHT_PROBLEMS = preflight()
    if PREFLIGHT_PROBLEMS:
        sys.stderr.write("Preflight warnings — the server will still start so you can\n"
                         "see the error in the browser:\n\n")
        for p in PREFLIGHT_PROBLEMS:
            sys.stderr.write("  - " + p + "\n\n")

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as e:
        _show_fatal("Handwriting compile server",
                    f"Could not bind {args.host}:{args.port} — {e}.\n"
                    f"Another instance may already be running.")
        sys.exit(1)

    url = f"http://{args.host}:{args.port}"
    print(f"Test Compile UI ready: {url}")
    print(f"  lualatex: {LUALATEX}")
    font_status = "built" if FONT_OUT.exists() else "not yet built (first Compile will build it)"
    print(f"  font:     {FONT_OUT} [{font_status}]")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as _e:
        import traceback
        _tb = traceback.format_exc()
        _show_fatal("Handwriting compile server — fatal error", _tb)
        raise
