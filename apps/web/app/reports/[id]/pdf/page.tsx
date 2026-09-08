'use client';

import {use, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import type {PDFDocumentProxy, RenderTask} from 'pdfjs-dist';

/** Render locally: never navigate the installed app into the device PDF viewer. */
export default function PdfPage({params}: {params:Promise<{id:string}>}) {
  const {id} = use(params);
  const [doc,setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page,setPage] = useState(1);
  const [zoom,setZoom] = useState(1);
  const [width,setWidth] = useState(320);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [pageText,setPageText] = useState('');
  const [retry,setRetry] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const size = entries[0]?.contentRect.width;
      if (size) setWidth(Math.max(100,Math.floor(size)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  },[]);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    const abort = new AbortController();
    setDoc(null);setPage(1);setLoading(true);setError('');
    async function load() {
      try {
        const response = await fetch(`/api/reports/${id}/pdf`,{cache:'no-store',signal:abort.signal});
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.reason ?? 'Unable to open this PDF.');
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        const pdf = await import('pdfjs-dist');
        if (!active) return;
        pdf.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
        task = pdf.getDocument({data:bytes});
        const document = await task.promise;
        if (active) setDoc(document);
      } catch (e) {if (active) {setError(e instanceof Error ? e.message : 'Unable to open PDF.');setLoading(false);}}
    }
    void load();
    return () => {active=false;abort.abort();if (task) void task.destroy();};
  },[id,retry]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let active = true;
    let render:RenderTask | undefined;
    const surface = canvas.current;
    setLoading(true);setError('');setPageText('');
    async function draw() {
      try {
        const pdfPage = await doc!.getPage(page);
        if (!active) return;
        const base = pdfPage.getViewport({scale:1});
        const viewport = pdfPage.getViewport({scale:width / base.width * zoom});
        const ratio = Math.min(window.devicePixelRatio || 1,2);
        surface.width = Math.ceil(viewport.width * ratio);
        surface.height = Math.ceil(viewport.height * ratio);
        surface.style.width = `${viewport.width}px`;
        surface.style.height = `${viewport.height}px`;
        render = pdfPage.render({canvas:surface,viewport,transform:[ratio,0,0,ratio,0,0]});
        await render.promise;
        const text = await pdfPage.getTextContent();
        if (active) {setPageText(text.items.map(i => 'str' in i ? i.str : '').join(' '));setLoading(false);}
      } catch(e) {if (active) {setError(e instanceof Error ? e.message : 'Unable to display this page.');setLoading(false);}}
    }
    void draw();
    return () => {active=false;render?.cancel();};
  },[doc,page,width,zoom]);
  return <main className="wrap">
    <Link href={`/reports/${id}`} replace className="back">← Back to report</Link>
    <div className="pagehead"><div><h1>Report PDF</h1><p className="sub">View the document without leaving RELAY</p></div></div>
    <div className="btn-row" style={{flexWrap:'wrap'}}>
      <button disabled={!doc || page === 1 || loading} onClick={() => setPage(p => p-1)}>Previous page</button>
      <span aria-live="polite">{doc ? `Page ${page} of ${doc.numPages}` : 'PDF'}</span>
      <button disabled={!doc || page === doc.numPages || loading} onClick={() => setPage(p => p+1)}>Next page</button>
      <label>Zoom <select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>Fit width</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
      {doc && <a className="back" href={`/api/reports/${id}/pdf?download=1`} download>Download PDF</a>}
    </div>
    {loading && <p role="status">Loading PDF…</p>}
    {error && <div role="alert" className="note note-bad"><p>{error}</p><button onClick={() => setRetry(n => n+1)}>Try again</button> <Link href="/signin">Sign in</Link></div>}
    <div ref={container} style={{width:'100%',overflowX:'auto',marginTop:16}}>
      {doc && <canvas key={`${page}-${width}-${zoom}`} ref={canvas} role="img" aria-label={`Report PDF, page ${page}. Text is available below.`} style={{display:error ? 'none':'block',background:'#fff'}} />}
    </div>
    {pageText && <details style={{marginTop:16}}><summary>Read page text</summary><p>{pageText}</p></details>}
    <Link href={`/reports/${id}/preview`} replace className="back">View report summary</Link>
  </main>;
}
