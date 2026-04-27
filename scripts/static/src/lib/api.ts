export type CharsResponse = {
  chars: string[];
  counts?: Record<string, number>;
  mtime?: number;
};

export type CompileResponse = {
  ok: boolean;
  pdf?: string;
  log?: string;
  stage?: string;
};

export async function fetchChars(): Promise<CharsResponse> {
  const r = await fetch('/chars');
  if (!r.ok) throw new Error(`/chars HTTP ${r.status}`);
  return r.json();
}

export async function fetchDefaultTemplate(): Promise<string> {
  const r = await fetch('/default_template');
  if (!r.ok) throw new Error(`/default_template HTTP ${r.status}`);
  const data = (await r.json()) as { latex: string };
  return data.latex;
}

export async function postCompile(body: {
  latex: string;
  rebuild: boolean;
  skip_pull: boolean;
}): Promise<CompileResponse> {
  const r = await fetch('/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
