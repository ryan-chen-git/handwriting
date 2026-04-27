type Props = {
  open: boolean;
  onClose: () => void;
  errors: string[];
  rawLog: string;
  status: 'idle' | 'success' | 'error';
};

// Sections whose body is verbose but critical when diagnosing font
// issues — open these by default so the first thing you see is the
// final doc.tex lualatex ran on and any fontspec lines from doc.log.
const OPEN_BY_DEFAULT = new Set([
  'request',
  'font environment',
  'normalize',
  'final doc.tex (what lualatex will see)',
  'fontspec / error lines from doc.log',
]);

type Section = { title: string; body: string };

// The backend emits `=== SECTION: <title> ===` markers followed by the
// section body. Anything before the first marker is kept as preamble
// (usually the "$ cmd" lines from build-font). We split on those markers
// and render each section as a collapsible <details>.
function parseSections(raw: string): { preamble: string; sections: Section[] } {
  const MARKER = /^=== SECTION: (.+?) ===$/;
  const lines = raw.split('\n');
  const sections: Section[] = [];
  const preambleLines: string[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const m = line.match(MARKER);
    if (m) {
      if (current) sections.push({ title: current.title, body: current.body.replace(/\n$/, '') });
      current = { title: m[1], body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    } else {
      preambleLines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.body.replace(/\n$/, '') });
  return { preamble: preambleLines.join('\n').trim(), sections };
}

export default function LogsPanel({ open, errors, rawLog, status }: Props) {
  if (!open) return null;

  const { preamble, sections } = parseSections(rawLog || '');

  return (
    <div className="logs-pane new-logs-pane" role="dialog" aria-label="Compile logs">
      {status === 'idle' && (
        <div className="logs-empty">
          <p>No compile run yet.</p>
        </div>
      )}

      {status === 'success' && errors.length === 0 && (
        <div className="logs-empty logs-empty--success">
          <p>Compile succeeded — no errors.</p>
        </div>
      )}

      {errors.length > 0 && (
        <>
          <h4 className="log-section-header is-error">Errors ({errors.length})</h4>
          {errors.map((e, i) => (
            <div key={i} className="log-entry">
              <pre>{e}</pre>
            </div>
          ))}
        </>
      )}

      {preamble && (
        <>
          <h4 className="log-section-header">Build steps</h4>
          <pre className="log-raw">{preamble}</pre>
        </>
      )}

      {sections.length > 0 && (
        <>
          <h4 className="log-section-header">Compile diagnostics</h4>
          {sections.map((s, i) => (
            <details
              key={i}
              className="log-section"
              open={OPEN_BY_DEFAULT.has(s.title)}
            >
              <summary>{s.title}</summary>
              <pre className="log-raw">{s.body}</pre>
            </details>
          ))}
        </>
      )}

      {!preamble && sections.length === 0 && rawLog && (
        <>
          <h4 className="log-section-header">Raw log</h4>
          <pre className="log-raw">{rawLog}</pre>
        </>
      )}
    </div>
  );
}
