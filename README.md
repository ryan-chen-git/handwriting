# handwriting

Render LaTeX documents in your own handwriting. Draw samples on an iPad (or any
stylus device) via a hosted web app, pull them to your machine, build an
OpenType font with a MATH table, and typeset with LuaLaTeX — everything from
body text to matrices and stretchy delimiters renders in your hand.

## How it fits together

```
  iPad / stylus browser               your laptop or PC
  ───────────────────                 ────────────────────────────
  Vercel collect-app      ──────►     pull_samples.py
  (stores strokes in                  preprocess.py
   Vercel Blob)                       build_font.py      → HandwritingFont.otf
                                                         + .manifest.json
                                      lualatex           → PDF

                     Test Compile UI (localhost:8787)
                     — wires all of the above together, one click
```

There are two sides:

1. **Collection (hosted):** a Vercel-deployed web app where you draw
   characters. Strokes are stored in Vercel Blob so you can collect from any
   device.
2. **Compile (local):** a Python HTTP server at `http://127.0.0.1:8787`
   serves a small web UI and runs the build-and-compile pipeline on every
   click.

LaTeX deliberately stays local — running TeX + font-builder in the cloud
isn't worth a Docker setup for a personal tool.

## Setup

You need two things on your machine: **Python 3.10+** and a **TeX
distribution** (provides `lualatex`). The Python venv and dependencies are
created automatically by the launcher on first run.

### 1. Install Python (if you don't already have it)

- **Windows:** install from <https://python.org> and tick *Add Python to PATH*.
- **macOS:** `brew install python`
- **Debian / Ubuntu:** `sudo apt install python3 python3-venv`

### 2. Install a TeX distribution

- **Windows:** `winget install MiKTeX.MiKTeX` — when you first compile,
  MiKTeX will prompt to install missing packages on demand. Click *Install*
  (or in MiKTeX Console → Settings, set *Install missing packages on-the-fly*
  to *Yes*).
- **macOS:** `brew install --cask mactex`
- **Debian / Ubuntu:**
  ```
  sudo apt install texlive-luatex texlive-latex-recommended \
                   texlive-latex-extra texlive-fonts-extra texlive-science
  ```

Open a fresh terminal afterwards and verify with `lualatex --version`.

### 3. Run it

Clone the repo and double-click the launcher for your OS:

| OS | Launcher | Notes |
|---|---|---|
| Windows | `run.bat` | Runs silently — no console window. |
| macOS | `run.command` | Opens Terminal; close it to stop the server. |
| Linux | `run.sh` | Or `./run.sh` from a terminal. |

On first run the launcher creates `venv/`, installs `requirements.txt`, and
starts the server. Subsequent runs reuse the existing venv. To force a clean
rebuild, delete `venv/`.

The server runs a preflight at startup; if `fontTools` or `lualatex` is
missing, the *browser* shows a clear page telling you what to install — no
console required.

## The Test Compile page

- **Presets** — one-click fills for common test inputs (alphabet, math,
  matrices, fractions, Greek).
- **LaTeX editor** — paste or type a complete `.tex` document. Any of your
  own font-selection lines (`fontspec`, `unicode-math`, `\setmainfont`,
  `\setmathfont`, …) are stripped and replaced server-side with the
  handwriting fontspec, so the handwriting font always wins.
- **Collected chars panel** — lists what's been pulled locally; highlights any
  letters/digits in your input that you haven't drawn yet.
- **Rebuild font** (on by default) — before compiling, re-run the pipeline:
  pull samples → preprocess → build font. Uncheck for fast iteration on
  pure LaTeX changes against the existing `outputs/HandwritingFont.otf`.
- **Skip pull** — when rebuilding, reuse the last-pulled samples instead of
  hitting the collect-app again. Useful when drawing is paused.
- **Compile** — writes the normalized `.tex` to a temp dir, runs `lualatex`,
  and streams the resulting PDF into the iframe on the right with the full
  log below. Builds are cached by SHA-256 of the inputs, so re-Compiling
  with no new samples skips the font build entirely.

## Collecting your own samples

The default collection endpoint is `https://collect-app-ten.vercel.app`. If
you just want to try the pipeline, skip this section — you'll typeset in the
repo owner's handwriting, not your own.

To use **your own** handwriting:

1. Deploy the collector under your own Vercel account:
   ```
   cd collect-app
   npx vercel --prod
   ```
   You'll need a Vercel account and a Blob store attached to the project
   (Vercel dashboard → Storage → Create → Blob; the app picks up
   `BLOB_READ_WRITE_TOKEN` automatically).
2. Open the deployed URL on your iPad / laptop, walk through the categories,
   draw each character. Data is saved to Blob on every "Accept" — each
   sample carries the canvas geometry it was drawn on, so resizing the
   collection UI later doesn't silently misalign older samples.
3. Point the compile pipeline at your deployment by either editing
   `DEFAULT_URL` at the top of `scripts/pull_samples.py` or passing
   `--url https://your-app.vercel.app` the first time.

## Running the pipeline directly

If you'd rather build the font from the CLI without the web UI:

```
python scripts/pull_samples.py                             # → data/raw_samples/
python scripts/preprocess.py \
  data/raw_samples/ data/processed/                        # → normalized glyph data
python scripts/build_font.py \
  data/processed/ outputs/HandwritingFont.otf              # → font + .manifest.json
```

`build_font.py` writes `outputs/HandwritingFont.manifest.json` next to the
font with a SHA-256 of the inputs, the sample/char count, pressure summary,
and build timestamp. The compile server includes a one-line manifest
summary in every Compile log so a stale build is visible at a glance.

Then compile any `.tex` yourself:

```
lualatex examples/stress.tex
```

Sample documents in `examples/`:

- `lowercase.tex` — lowercase pangrams and common words
- `spacing.tex` — spacing stress with thin/wide/round letters
- `font_math.tex` — math primitives
- `stress.tex` — 20-section end-to-end math stress test

Server endpoints (if you ever want to script the web UI):

```
GET  /                  Test Compile HTML page
GET  /health            { ok, font_exists, lualatex }
GET  /chars             { chars, counts, mtime }   — from data/raw_samples
GET  /default_template  { latex }                  — seed for the editor
POST /compile           { latex, rebuild, skip_pull }
                        → { ok, pdf(base64), log, stage }
```

## Repo layout

```
collect-app/           Vercel web app (static UI + /api/* serverless fns)
  index.html           Collection UI (iPad-friendly, vanilla JS)
  api/                 save / export / progress / list-char / delete[-all]

scripts/
  compile_server.py    Local HTTP server for the Test Compile UI
  pull_samples.py      Pull samples from the deployed collect-app
  preprocess.py        Normalize raw strokes → CharacterSample JSON
  build_font.py        fontTools: samples → OpenType .otf + manifest sidecar
  static/              Vite-built UI bundle served by compile_server

renderer/glyph_model.py      CharacterSample + SampleLibrary dataclasses

examples/              Sample LaTeX documents
tests/                 pytest suite

data/raw_samples/      Pulled stroke JSON (gitignored)
data/processed/        Normalized samples (gitignored, regeneratable)
outputs/               Built font + .manifest.json (gitignored)
```

## License / credits

Personal project. The pipeline uses
[fontTools](https://github.com/fonttools/fonttools) and writes an OpenType
font with an OpenType MATH table compatible with `unicode-math` (LuaLaTeX).
