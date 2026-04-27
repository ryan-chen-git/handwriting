// Canned LaTeX documents that exercise different parts of the compile
// pipeline. The rail's "tests" tab surfaces these; clicking one drops a
// new .tex file into the file tree and switches to it. No font code
// lives here — the backend strips any font-selection lines and injects
// the handwriting fontspec at compile time.
export type TestPreset = {
  id: string;
  label: string;
  description: string;
  fileName: string;
  content: string;
};

export const TEST_PRESETS: TestPreset[] = [
  {
    id: 'basic',
    label: 'Basic article',
    description: 'Minimal compile — plain paragraph.',
    fileName: 'test-basic.tex',
    content: `\\documentclass{article}

\\begin{document}

Hello from a basic article. No math, no sections.

\\end{document}
`,
  },
  {
    id: 'math',
    label: 'Math expressions',
    description: 'Inline, display, and aligned math.',
    fileName: 'test-math.tex',
    content: `\\documentclass{article}
\\usepackage{amsmath}

\\begin{document}

\\section*{Math}

Inline: $e^{i\\pi} + 1 = 0$.

Display:
\\[ \\int_0^\\infty e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2} \\]

Aligned:
\\begin{align}
  a^2 + b^2 &= c^2 \\\\
  \\sum_{n=1}^\\infty \\frac{1}{n^2} &= \\frac{\\pi^2}{6}
\\end{align}

\\end{document}
`,
  },
  {
    id: 'sections',
    label: 'Sections and lists',
    description: 'Title, sectioning, itemize, enumerate.',
    fileName: 'test-sections.tex',
    content: `\\documentclass{article}

\\title{Sections Demo}
\\author{}
\\date{}

\\begin{document}
\\maketitle

\\section{Introduction}
First section.

\\subsection{Goals}
\\begin{itemize}
  \\item Render the handwriting font.
  \\item Support basic structure.
  \\item Fail loudly on malformed input.
\\end{itemize}

\\subsection{Steps}
\\begin{enumerate}
  \\item Write LaTeX.
  \\item Hit recompile.
  \\item Read the PDF.
\\end{enumerate}

\\section{Conclusion}
That's it.

\\end{document}
`,
  },
  {
    id: 'broken',
    label: 'Malformed (error test)',
    description: 'Missing \\end{document} — should surface a lualatex error.',
    fileName: 'test-broken.tex',
    content: `\\documentclass{article}

\\begin{document}

This document is deliberately missing its closing tag. The compile
should fail and the Logs panel should show the lualatex error.

\\section{No end}
Oops.
`,
  },
];
