import { useCallback, useEffect, useRef, useState } from 'react';
import { postCompile, fetchDefaultTemplate } from './lib/api';
import Topbar from './components/Topbar';
import LeftRail, { type RailKey } from './components/LeftRail';
import RailPanel, { type TexFile } from './components/RailPanel';
import CodeEditor from './components/CodeEditor';
import PdfToolbar from './components/PdfToolbar';
import ClonedPdfViewer from './components/ClonedPdfViewer';
import LogsPanel from './components/LogsPanel';
import SplitDivider from './components/SplitDivider';
import type { TestPreset } from './lib/test-presets';
import { useDetachCompileContext } from './shared/context/detach-compile-context';

// Seed used only if `/default_template` fails (server unreachable). No
// font code here — the backend strips and re-injects font-selection
// lines at compile time, so the editor stays clean.
const FALLBACK_LATEX = `\\documentclass{article}

\\title{Handwriting Test Compile}
\\author{}
\\date{}

\\begin{document}
\\maketitle

Hello, world.

\\[ E = mc^2 \\]

\\end{document}
`;

const MAIN_FILE = 'main.tex';

type CompileStatus = 'idle' | 'success' | 'error';

export default function App() {
  const [files, setFiles] = useState<TexFile[]>([{ name: MAIN_FILE, content: FALLBACK_LATEX }]);
  const [activeFileName, setActiveFileName] = useState<string>(MAIN_FILE);
  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [rawLog, setRawLog] = useState<string>('');
  const [logsOpen, setLogsOpen] = useState(false);

  const [activeRail, setActiveRail] = useState<RailKey | null>(null);
  const [pdfSize, setPdfSize] = useState<number | undefined>(undefined);

  const { darkModePdf } = useDetachCompileContext();

  const prevPdfUrlRef = useRef<string | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState<number>(() => {
    const saved = Number(localStorage.getItem('ol:leftPct'));
    return Number.isFinite(saved) && saved >= 20 && saved <= 80 ? saved : 50;
  });

  const activeFile = files.find((f) => f.name === activeFileName) ?? files[0];
  const latex = activeFile?.content ?? '';

  const setActiveContent = useCallback((next: string) => {
    setFiles((prev) => prev.map((f) => (f.name === activeFileName ? { ...f, content: next } : f)));
  }, [activeFileName]);

  useEffect(() => {
    localStorage.setItem('ol:leftPct', String(leftPct));
  }, [leftPct]);

  useEffect(() => {
    let cancelled = false;
    fetchDefaultTemplate()
      .then((tpl) => {
        if (cancelled) return;
        setFiles((prev) => prev.map((f) => (f.name === MAIN_FILE ? { ...f, content: tpl } : f)));
      })
      .catch(() => {
        // keep FALLBACK_LATEX
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDividerDrag = useCallback((clientX: number) => {
    const el = splitRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setLeftPct(Math.max(20, Math.min(80, pct)));
  }, []);

  const openPreset = useCallback((preset: TestPreset) => {
    setFiles((prev) => {
      const existing = prev.find((f) => f.name === preset.fileName);
      if (existing) return prev;
      return [...prev, { name: preset.fileName, content: preset.content }];
    });
    setActiveFileName(preset.fileName);
    setActiveRail('files');
  }, []);

  const onCompile = useCallback(async () => {
    if (compiling) return;
    if (!latex.trim()) {
      setCompileStatus('error');
      setErrors(['Editor is empty — nothing to compile.']);
      setRawLog('');
      setLogsOpen(true);
      return;
    }
    setCompiling(true);
    try {
      const data = await postCompile({ latex, rebuild: true, skip_pull: false });
      if (!data.ok) {
        setCompileStatus('error');
        const stage = data.stage ? `stage: ${data.stage}` : 'compile failed';
        setErrors([`Compile failed (${stage}). See diagnostic sections below.`]);
        setRawLog(data.log || '');
        setLogsOpen(true);
        return;
      }

      setCompileStatus('success');
      setErrors([]);
      setRawLog(data.log || '');

      const bin = atob(data.pdf || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (prevPdfUrlRef.current) URL.revokeObjectURL(prevPdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevPdfUrlRef.current = url;
      setPdfUrl(url);
      setPdfSize(bytes.byteLength);
    } catch (err) {
      setCompileStatus('error');
      setErrors([`Network error: ${String(err)}`]);
      setRawLog('');
      setLogsOpen(true);
    } finally {
      setCompiling(false);
    }
  }, [latex, compiling]);

  useEffect(() => {
    return () => {
      if (prevPdfUrlRef.current) URL.revokeObjectURL(prevPdfUrlRef.current);
    };
  }, []);

  return (
    <div className="ide-redesign-body">
      <Topbar projectName="handwriting-test" />
      <div className="ide-redesign-main" style={{ gridTemplateColumns: `40px ${activeRail ? '240px ' : ''}1fr` }}>
        <LeftRail
          active={activeRail}
          onSelect={(k) => setActiveRail((cur) => (cur === k ? null : k))}
        />
        {activeRail && (
          <RailPanel
            active={activeRail}
            files={files}
            activeFileName={activeFileName}
            onSelectFile={setActiveFileName}
            onOpenPreset={openPreset}
            onClose={() => setActiveRail(null)}
          />
        )}
        <div className="ide-redesign-split" ref={splitRef} style={{ gridTemplateColumns: `${leftPct}% auto 1fr` }}>
          <section className="ide-redesign-editor-container">
            <CodeEditor key={activeFileName} value={latex} onChange={setActiveContent} />
          </section>

          <SplitDivider onDrag={handleDividerDrag} />

          <section className={`ide-redesign-pdf-container pdf${darkModePdf ? ' pdf-dark-mode' : ''}`}>
            <PdfToolbar
              compiling={compiling}
              errorCount={errors.length}
              onCompile={onCompile}
              onToggleLogs={() => setLogsOpen((v) => !v)}
              logsOpen={logsOpen}
              hasPdf={!!pdfUrl}
              pdfUrl={pdfUrl}
            />
            {logsOpen ? (
              <LogsPanel
                open={logsOpen}
                onClose={() => setLogsOpen(false)}
                errors={errors}
                rawLog={rawLog}
                status={compileStatus}
              />
            ) : (
              <ClonedPdfViewer pdfUrl={pdfUrl} pdfSize={pdfSize} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
