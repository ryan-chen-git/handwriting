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
import contextlib
import importlib.util
import io
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Build-pipeline modules — invoked in-process so we don't pay the cost of
# launching a fresh Python interpreter (and re-importing fontTools) on every
# Compile click.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import build_font as build_font_mod  # noqa: E402
from scripts import preprocess as preprocess_mod  # noqa: E402
from scripts import pull_samples as pull_samples_mod  # noqa: E402
from renderer.glyph_model import SampleLibrary  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
FONT_OUT = REPO_ROOT / "outputs" / "HandwritingFont.otf"
FONT_MANIFEST = FONT_OUT.with_suffix(".manifest.json")
STATIC_DIR = Path(__file__).resolve().parent / "static"
RAW_SAMPLES_FILE = REPO_ROOT / "data" / "raw_samples" / "collected_samples.json"

# Serializes /compile across threads — the build pipeline reads and writes
# shared paths under data/, and concurrent compiles would interleave them.
BUILD_LOCK = threading.Lock()

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

# lualatex on heavy math docs needs some headroom but should never legitimately
# exceed 90s for the kinds of documents this server runs.
LUALATEX_TIMEOUT_S = 90

# Persistent compile working directory. Reusing the same directory across
# compiles preserves .aux / .toc / .bbl, which lets lualatex skip redundant
# passes when the user only edits prose and cross-references stay valid —
# the same trick Overleaf's CLSI uses per-project. Stale .aux from large
# structural edits self-corrects on the next pass.
COMPILE_CACHE_DIR = Path(tempfile.gettempdir()) / "hwcompile-cache"
COMPILE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

RAW_SAMPLES_DIR = REPO_ROOT / "data" / "raw_samples"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
DEFAULT_COLLECT_URL = pull_samples_mod.DEFAULT_URL


def run_capture(cmd, cwd, timeout):
    """Subprocess wrapper used only for lualatex now — build steps run in-process."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            **_SUBPROCESS_KW,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as e:
        return (
            124,
            e.stdout.decode("utf-8", errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or ""),
            f"[timeout after {timeout}s] {' '.join(cmd)}\n"
            + (e.stderr.decode("utf-8", errors="replace") if isinstance(e.stderr, bytes) else (e.stderr or "")),
        )


@contextlib.contextmanager
def _capture_step(logs: list, label: str):
    """Run a build step, prefix its captured stdout/stderr with `[label] `,
    log how long it took, and re-raise on failure with a logged traceback.
    """
    buf = io.StringIO()
    t0 = time.monotonic()
    logs.append(f"$ in-process: {label}")
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            yield
    except Exception:
        logs.append(buf.getvalue().rstrip())
        logs.append(traceback.format_exc().rstrip())
        raise
    out = buf.getvalue().rstrip()
    if out:
        logs.append(out)
    logs.append(f"[done] {label} in {time.monotonic() - t0:.2f}s")


def _read_existing_manifest() -> dict | None:
    if not FONT_MANIFEST.exists():
        return None
    try:
        return json.loads(FONT_MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def run_data_pipeline(logs):
    """Pull samples from the collect-app, preprocess them, and (re)build the
    handwriting font. Driven exclusively by the rail's "Pull samples" button.

    Each step appends a one-line status to `logs`. Returns a dict on success
    or raises on failure so the caller can surface the error.
    """
    # 1/3 — pull
    pull_count = pull_samples_mod.pull_samples(DEFAULT_COLLECT_URL, RAW_SAMPLES_DIR)
    logs.append(f"[1/3] pulled {pull_count} sample(s) from {DEFAULT_COLLECT_URL}")

    # 2/3 — preprocess
    processed, rejected = preprocess_mod.preprocess_all(RAW_SAMPLES_DIR, PROCESSED_DIR)
    logs.append(f"[2/3] preprocessed {processed} sample(s), rejected {rejected}")

    # 3/3 — build font (cache by hash of processed/ contents)
    new_hash = build_font_mod._hash_processed_dir(PROCESSED_DIR)
    existing = _read_existing_manifest()
    cache_hit = (
        existing
        and existing.get("samples_hash") == new_hash
        and FONT_OUT.exists()
    )
    if cache_hit:
        logs.append(
            f"[3/3] font cache hit (samples hash {new_hash[:12]}…) — "
            f"reusing {FONT_OUT.name}"
        )
        glyph_count = existing.get("char_count", 0) if existing else 0
    else:
        library = SampleLibrary.load(PROCESSED_DIR)
        glyphs = build_font_mod.build_font(library, FONT_OUT)
        build_font_mod.write_manifest(FONT_OUT, PROCESSED_DIR, library, glyphs)
        glyph_count = len(glyphs)
        logs.append(
            f"[3/3] built {FONT_OUT.name} from {library.count()} sample(s) "
            f"across {glyph_count} glyph(s)"
        )

    return {
        "pull_count": pull_count,
        "processed": processed,
        "rejected": rejected,
        "glyph_count": glyph_count,
        "cache_hit": bool(cache_hit),
    }


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


def compile_latex(latex_source, logs, stop_on_first_error=False):
    """Run lualatex on the user's source and return the PDF bytes.

    Assumes the handwriting font is already built — building/pulling is the
    job of the /pull-samples endpoint, not this one.
    """
    if not FONT_OUT.exists():
        logs.append(
            "Handwriting font not built yet. Click 'Pull samples' in the "
            "rail to download the latest samples and build the font."
        )
        return None

    if not LUALATEX:
        logs.append("lualatex not found. Install a TeX distribution:")
        logs.append("  Windows:       winget install MiKTeX.MiKTeX")
        logs.append("  macOS:         brew install --cask mactex")
        logs.append(
            "  Debian/Ubuntu: sudo apt install texlive-luatex "
            "texlive-latex-extra texlive-fonts-extra texlive-science"
        )
        return None

    # Strip any user-provided fontspec setup and inject ours.
    final_tex, stripped, _marker_idx = normalize_font_preamble(latex_source)
    if stripped:
        _section(
            logs,
            "preamble normalization",
            f"stripped {len(stripped)} font setup line(s):\n"
            + "\n".join(f"  - {ln}" for ln in stripped),
        )

    _section(logs, "final source", _numbered(final_tex))

    tex_path = COMPILE_CACHE_DIR / "doc.tex"
    tex_path.write_text(final_tex, encoding="utf-8")

    cmd = [
        LUALATEX,
        "-interaction=nonstopmode",
        "-no-shell-escape",
        f"-output-directory={COMPILE_CACHE_DIR}",
    ]
    if stop_on_first_error:
        cmd.insert(2, "-halt-on-error")
    cmd.append(str(tex_path))

    code, out, err = run_capture(cmd, COMPILE_CACHE_DIR, LUALATEX_TIMEOUT_S)

    _section(logs, f"lualatex (exit {code})", (out or "")[-4000:])
    if err:
        _section(logs, "lualatex stderr", err[-2000:])

    pdf_path = COMPILE_CACHE_DIR / "doc.pdf"
    if not pdf_path.exists():
        logs.append(f"[exit {code}] no PDF produced")
        return None
    return pdf_path.read_bytes()


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
        if self.path.startswith("/samples"):
            # /samples?char=X — return the raw strokes for every collected
            # sample of that character, for the handwriting viewer modal.
            from urllib.parse import parse_qs, urlsplit
            query = parse_qs(urlsplit(self.path).query)
            target = (query.get("char") or [""])[0]
            if not target:
                self._json(400, {"error": "char query param required"})
                return
            if not RAW_SAMPLES_FILE.exists():
                self._json(200, {"char": target, "samples": []})
                return
            try:
                data = json.loads(RAW_SAMPLES_FILE.read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                self._json(500, {"error": f"read samples failed: {e}"})
                return
            matches = [
                {"strokes": s.get("strokes", [])}
                for s in data.get("samples", [])
                if s.get("char") == target
            ]
            self._json(200, {"char": target, "samples": matches})
            return
        if self.path == "/default_template":
            self._json(200, {"latex": DEFAULT_TEMPLATE})
            return
        # Serve Vite build assets (Vite output under /assets/, plus files
        # copied verbatim from public/ which land at the dist root —
        # /fonts/, /img/ — plus a few standard root files). Constrain
        # everything to dist/ to avoid path traversal.
        if (
            self.path.startswith("/assets/")
            or self.path.startswith("/fonts/")
            or self.path.startswith("/img/")
            or self.path in (
                "/favicon.ico", "/favicon.svg", "/robots.txt", "/manifest.webmanifest",
            )
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
        if self.path == "/pull-samples":
            logs: list[str] = []
            try:
                with BUILD_LOCK:
                    summary = run_data_pipeline(logs)
                chars, counts, mtime = read_collected_chars()
                self._json(200, {
                    "ok": True,
                    "count": summary["pull_count"],
                    "processed": summary["processed"],
                    "rejected": summary["rejected"],
                    "glyph_count": summary["glyph_count"],
                    "cache_hit": summary["cache_hit"],
                    "chars": chars,
                    "counts": counts,
                    "mtime": mtime,
                    "log": "\n".join(logs),
                })
            except Exception as e:
                logs.append(f"[error] {e}")
                self._json(500, {
                    "ok": False,
                    "error": str(e),
                    "log": "\n".join(logs),
                })
            return
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
        stop_on_first_error = bool(req.get("stop_on_first_error", False))

        logs = []
        try:
            with BUILD_LOCK:
                pdf = compile_latex(latex, logs, stop_on_first_error)
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
    font_status = "built" if FONT_OUT.exists() else "not yet built (click 'Pull samples' in the rail)"
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
