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

## The Test Compile UI

The local web UI is a fork of upstream Overleaf's frontend, lifted verbatim
and stubbed for offline single-user use (no auth, no real-time collab, no
cloud). It runs on `localhost:8787` and behaves like a normal Overleaf
project, with two custom additions:

- **Samples rail tab** (the brush icon, left rail) — manages the handwriting
  data. The header has a refresh icon that triggers
  `POST /pull-samples` (pull → preprocess → build font); the body lists
  every renderable character grouped by category (Lowercase, Uppercase,
  Digits, Punctuation, Brackets, Operators, Other). Each row shows the
  character, its descriptive name (e.g. *lowercase a*), and how many samples
  you've collected. Red rows = no samples yet (the font will fall back to
  a default glyph there). Click a row to inspect the actual collected
  strokes for that character in the **Samples Viewer** panel below.
- **Documentation modal** (Help → Documentation) — explains the pipeline,
  the cache, and the offline-build deviations.

Otherwise it's the regular Overleaf experience: file tree, multi-file
project, LaTeX editor with syntax highlight + lint + autocomplete + symbol
palette, PDF preview with synctex, settings modal, etc. Compile runs
`lualatex` against your source plus the built handwriting font; user-set
font lines (`\setmainfont`, `\setmathfont`, `unicode-math`, …) are stripped
and replaced with the handwriting fontspec server-side, so the font always
wins.

**Pull and compile are separate steps.** The Recompile button only runs
`lualatex` against the current `HandwritingFont.otf`. To pick up new
samples you've collected, open the *Samples* rail tab and hit the refresh
icon — that's the only path that hits the collect-app.

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
GET    /                          IDE HTML entry
GET    /health                    { ok, font_exists, lualatex }
GET    /chars                     { chars, counts, mtime }
GET    /samples?char=X            { char, samples: [{strokes: [[x,y,p?], …]}] }
GET    /default_template          { latex }
POST   /pull-samples              { ok, count, processed, rejected, glyph_count,
                                    cache_hit, chars, counts, mtime, log }
POST   /compile                   { latex, stop_on_first_error? }
                                  → { ok, pdf(base64), log, stage }
```

Compile artifacts (`.aux`, `.toc`, `.bbl`, …) persist in
`/tmp/hwcompile-cache/` so cross-references converge faster on repeat
builds. Delete that directory if you ever suspect stale state.

## Repo layout

```
collect-app/           Vercel web app (static UI + /api/* serverless fns)
  index.html           Collection UI (iPad-friendly, vanilla JS)
  api/                 save / export / progress / list-char / delete[-all]

scripts/
  compile_server.py    Local HTTP server (UI + /compile + /pull-samples + …)
  pull_samples.py      Pull samples from the deployed collect-app
  preprocess.py        Normalize raw strokes → CharacterSample JSON
  build_font.py        fontTools: samples → OpenType .otf + manifest sidecar
  static/              Vite-driven IDE: forked Overleaf frontend + offline glue
    src/js/            Vendored Overleaf source (patches marked "Offline build:")
    src/stubs/         Backend stand-ins for upstream-only packages
    public/            Static assets (Hunspell dictionaries, images)
    vite.config.ts     Aliases + middleware that fakes the upstream API

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
