'use client';

import {use, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import type {PDFDocumentProxy, RenderTask} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {safeViewReturn, withViewReturn} from '@/lib/viewNavigation';
import {PageTitle} from '@/components/PageTitle';
import {DownloadLink} from '@/components/DownloadLink';
import {failure} from '@/lib/failure';
import './pdf.css';

/** Render locally: never navigate the installed app into the device PDF viewer. */
export default function PdfPage({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}) {
  const {id} = use(params);
  const returnTo=safeViewReturn(use(searchParams).returnTo,'/projects');
  const [doc,setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page,setPage] = useState(1);
  const [zoom,setZoom] = useState(1);
  const [width,setWidth] = useState(320);
  const [error,setError] = useState('');
  /** The file came but this browser could not draw it: the download is the way to read it. */
  const [cannotShow,setCannotShow] = useState(false);
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
    let task: ReturnType<typeof import('pdfjs-dist/legacy/build/pdf.mjs')['getDocument']> | undefined;
    const abort = new AbortController();
    setDoc(null);setPage(1);setLoading(true);setError('');setCannotShow(false);
    async function load() {
      try {
        const response = await fetch(`/api/reports/${id}/pdf`,{cache:'no-store',signal:abort.signal});
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw failure(response.status, body, 'The PDF could not be opened.');
        }
        let bytes: Uint8Array;
        try { bytes = new Uint8Array(await response.arrayBuffer()); }
        catch { throw new TypeError('cut off'); }
        try {
          // The legacy build carries polyfills for browser features pdf.js now
          // relies on (such as Map.getOrInsertComputed), which older iPhones
          // and older desktop browsers lack; the modern build fails there.
          const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs');
          if (!active) return;
          pdf.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).toString();
          task = pdf.getDocument({data:bytes});
          const document = await task.promise;
          if (active) setDoc(document);
        } catch {
          // pdf.js could not read it, or this browser is too old for pdf.js: the file itself is fine.
          if (active) {setCannotShow(true);setError('This PDF could not be shown here, on this browser. Download the PDF to open it in your usual PDF reader.');setLoading(false);}
          return;
        }
      } catch (e) {
        if (!active || (e instanceof DOMException && e.name === 'AbortError')) return;
        setError(e instanceof TypeError || !(e instanceof Error) ? 'No connection, so the PDF could not be opened. Try again when there is signal.' : e.message);
        setLoading(false);
      }
    }
    void load();
    return () => {active=false;abort.abort();if (task) void task.destroy();};
  },[id,retry]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let active = true;
    let render:RenderTask | undefined;
    const surface = canvas.current;
    setLoading(true);setError('');setPageText('');setCannotShow(false);
    async function draw() {
      try {
        const pdfPage = await doc!.getPage(page);
        if (!active) return;
        const base = pdfPage.getViewport({scale:1});
        const viewport = pdfPage.getViewport({scale:width / base.width * zoom});
        // Safari on iOS refuses a canvas larger than about 16.7 million pixels
        // and returns a blank one rather than an error. A2 drawings at 200% on
        // a retina screen go past that, so the device pixel ratio is reduced
        // until the surface fits instead of silently rendering nothing.
        const CANVAS_LIMIT = 16_000_000;
        const area = viewport.width * viewport.height;
        const ratio = Math.max(1,Math.min(window.devicePixelRatio || 1,2,Math.sqrt(CANVAS_LIMIT / area)));
        surface.width = Math.ceil(viewport.width * ratio);
        surface.height = Math.ceil(viewport.height * ratio);
        surface.style.width = `${viewport.width}px`;
        surface.style.height = `${viewport.height}px`;
        render = pdfPage.render({canvas:surface,viewport,transform:[ratio,0,0,ratio,0,0]});
        await render.promise;
        const text = await pdfPage.getTextContent();
        if (active) {setPageText(text.items.map(i => 'str' in i ? i.str : '').join(' '));setLoading(false);}
      } catch(e) {
        if (!active || (e instanceof Error && e.name === 'RenderingCancelledException')) return;
        setCannotShow(true);setError(`Page ${page} could not be shown here, on this browser. Download the PDF to read it in your usual PDF reader.`);setLoading(false);
      }
    }
    void draw();
    return () => {active=false;render?.cancel();};
  },[doc,page,width,zoom]);
  return <main className="wrap eng-chrome">
    <PageTitle title="Report PDF" />
    <Link href={withViewReturn(`/reports/${id}`,returnTo)} replace className="back">← Back to report</Link>
    <div className="pagehead"><div><h1>Report PDF</h1><p className="sub">View the document without leaving RELAY</p></div></div>
    {/* The page controls come once there is a document to page through. */}
    {doc && <div className="pdf-tools">
      <button disabled={page === 1 || loading} onClick={() => setPage(p => p-1)}>Previous page</button>
      <span className="pdf-page" aria-live="polite">Page {page} of {doc.numPages}</span>
      <button disabled={page === doc.numPages || loading} onClick={() => setPage(p => p+1)}>Next page</button>
      <label className="pdf-zoom">Zoom <select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>Fit width</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
      <DownloadLink className="back" href={`/api/reports/${id}/pdf?download=1`} what="PDF">Download PDF</DownloadLink>
    </div>}
    {loading && <p role="status" className="pdf-status">Loading PDF…</p>}
    {error && <div role="alert" className="note note-bad pdf-problem"><p>{error}</p>{cannotShow
      ? <DownloadLink href={`/api/reports/${id}/pdf?download=1`} what="PDF">Download the PDF</DownloadLink>
      : <button onClick={() => setRetry(n => n+1)}>Try again</button>}</div>}
    <div ref={container} style={{width:'100%',overflowX:'auto',marginTop:16}}>
      {doc && <canvas key={`${page}-${width}-${zoom}`} ref={canvas} role="img" aria-label={`Report PDF, page ${page}. Text is available below.`} style={{display:error ? 'none':'block',background:'#fff'}} />}
    </div>
    {pageText && <details style={{marginTop:16}}><summary>Read page text</summary><p>{pageText}</p></details>}
    <Link href={withViewReturn(`/reports/${id}/preview`,returnTo)} replace className="back">View the document</Link>
  </main>;
}
