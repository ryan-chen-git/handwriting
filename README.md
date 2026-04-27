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
   Vercel Blob)                       build_variants.py
                                      build_font.py      → HandwritingFont.otf
                                      lualatex           → PDF

                     Test Compile UI (localhost:8787)
                     — wires all of the above together, one click
```

There are two sides:

1. **Collection side (hosted):** a Vercel-deployed web app where you draw
   characters. Strokes are stored in Vercel Blob. This stays online so you can
   collect from any device.
2. **Compile side (local):** everything after collection happens on your
   machine. A single Python HTTP server serves a small web UI at
   `http://127.0.0.1:8787` and drives the full build-and-compile pipeline when
   you click Compile.

LaTeX is deliberately **not** run in the cloud — a full TeX distribution plus
font-builder would need a Docker/cloud setup that isn't worth it for a
personal tool. Running locally is the simplest thing that works, and anyone who
clones this repo can use it the same way.

## One-time setup

You need three things: **Python 3.10+**, a **TeX distribution** (provides
`lualatex`), and the repo's Python dependencies.

### 1. Install a TeX distribution

Pick the command for your OS. Each one also pulls in the LaTeX packages we need
(`fontspec`, `unicode-math`, `amsmath`, `latinmodern-math`).

**Windows** (via winget):
```powershell
winget install MiKTeX.MiKTeX
```
When you first compile, MiKTeX will prompt to install missing packages on
demand — click **Install** (or open MiKTeX Console → Settings and set
"Install missing packages on-the-fly" to **Yes** to auto-accept).

**macOS** (via Homebrew):
```bash
brew install --cask mactex
```

**Debian / Ubuntu**:
```bash
sudo apt install texlive-luatex texlive-latex-recommended \
                 texlive-latex-extra texlive-fonts-extra texlive-science
```

After installing, open a **fresh terminal** and verify:
```
lualatex --version
```

### 2. Clone and install Python deps

```bash
git clone <this-repo>
cd handwriting
python -m venv venv
# activate the venv:
#   macOS/Linux:  source venv/bin/activate
#   Windows:      venv\Scripts\activate
pip install -r requirements.txt
```

## Run it

Once setup is done, you shouldn't need a terminal anymore. Just double-click
the launcher for your OS from the repo folder:

- **Windows:** `run.bat` (runs silently — no console window)
- **macOS:** `run.command` (opens Terminal; close it to stop the server)
- **Linux:** `run.sh` (or `./run.sh` from a terminal)

Each launcher activates the venv if one exists, starts the local server, and
opens your browser to the Test Compile page. The server runs a preflight at
startup; if `fontTools` or `lualatex` is missing, the *browser* shows a clear
page telling you what to install (no console required).

If you prefer the terminal:
```
python scripts/compile_server.py
```
Flags:
- `--port 8787` change port
- `--host 127.0.0.1` bind address (keep on loopback)
- `--no-open` don't auto-open a browser window

## The Test Compile page

- **Presets** — one-click fills for common test inputs (alphabet, math,
  matrices, fractions, Greek).
- **LaTeX textarea** — only the document body. The preamble (fontspec,
  unicode-math, `\setmainfont`/`\setmathfont` pointing at
  `outputs/HandwritingFont.otf`) is added server-side.
- **Collected chars panel** — lists what's been pulled locally; highlights any
  letters/digits in your input that you haven't drawn yet.
- **Rebuild font** (on by default) — before compiling, re-run the full
  pipeline: pull samples → preprocess → build variants → build font. Uncheck
  for fast iteration on pure LaTeX changes against the existing
  `outputs/HandwritingFont.otf`.
- **Skip pull** — when rebuilding, reuse the last-pulled samples instead of
  hitting the collect-app again. Useful when drawing is paused.
- **Compile** — writes the wrapped `.tex` to a temp dir, runs `lualatex`,
  streams the output PDF back into the iframe on the right and the full log
  into the console below.

## Collecting your own samples

The default collection endpoint is `https://collect-app-ten.vercel.app`. If
you just want to try the pipeline, skip this section — you'll typeset in the
repo owner's handwriting, though, not your own.

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
   draw each character. Data is saved to Blob on every "Accept".
3. Point the compile pipeline at your deployment by either editing
   `DEFAULT_URL` at the top of `scripts/pull_samples.py` or passing
   `--url https://your-app.vercel.app` the first time.

## Scripting the pipeline directly

If you'd rather build the font from the CLI without the web UI:

```
python scripts/pull_samples.py                             # → data/raw_samples/
python scripts/preprocess.py \
  data/raw_samples/ data/processed/                        # → normalized glyph data
python scripts/build_variants.py \
  data/processed/ data/variant_library/                    # → per-char variant library
python scripts/build_font.py \
  data/variant_library/ outputs/HandwritingFont.otf        # → the font
```

Then compile any `.tex` yourself:
```
lualatex test_stress.tex
```

Included test documents under the repo root:
- `test_lowercase.tex` — lowercase pangrams and common words
- `test_spacing.tex` — spacing stress with thin/wide/round letters
- `test_font_math.tex` — math primitives
- `test_stress.tex` — 20-section end-to-end math stress test

Server endpoints (if you ever want to script the web UI):
```
GET  /         Test Compile HTML page
GET  /health   { ok, font_exists, lualatex }
GET  /chars    { chars, counts, mtime }   — from data/raw_samples
POST /compile  { latex, rebuild, skip_pull, wrap }
               → { ok, pdf(base64), log, stage }
```

## Repo layout

```
collect-app/           Vercel web app (static page + /api/* serverless fns)
  public/index.html    Collection UI (iPad-friendly)
  api/                 save / export / progress / list-char / delete[-all]

scripts/
  compile_server.py    Local HTTP server for the Test Compile UI
  pull_samples.py      Pull samples from the deployed collect-app
  preprocess.py        Normalize raw strokes → CharacterSample JSON
  build_variants.py    Expand samples → variant library (with synthesis)
  build_font.py        fontTools: library → OpenType .otf w/ MATH table
  static/test_compile.html   UI page served by compile_server

renderer/glyph_model.py      Core dataclasses (CharacterSample, VariantLibrary)

data/raw_samples/      Pulled stroke JSON (gitignored)
data/processed/        Normalized (gitignored, regeneratable)
data/variant_library/  Variant library (gitignored, regeneratable)
outputs/               Built font + anything else (gitignored)

tests/                 pytest suite
```

## License / credits

Personal project. The pipeline uses [fontTools](https://github.com/fonttools/fonttools)
and writes an OpenType font with an OpenType MATH table compatible with
`unicode-math` (LuaLaTeX).
