'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Helpers shared by the two office workspaces (Compliance and Developments).
 * Nothing here knows about either domain: hash navigation, toasts, a modal
 * shell and a form reader.
 */

/**
 * Hash navigation with an internal history, so back works even where the host
 * blocks URL changes, and a deep link still opens the right screen.
 */
export function useHashRoute(fallback: string): { hash: string; go: (h: string) => void; back: () => void } {
  const [hash, setHash] = useState(fallback);
  const stack = useRef<string[]>([]);
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith('#/')) setHash(h);
    const onPop = () => { if (window.location.hash.startsWith('#/')) setHash(window.location.hash); };
    window.addEventListener('popstate', onPop); window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);
  const go = useCallback((h: string) => {
    setHash(prev => { if (prev !== h) { stack.current.push(prev); if (stack.current.length > 40) stack.current.shift(); } return h; });
    try { if (window.location.hash !== h) window.history.pushState(null, '', h); } catch { /* URL cannot change here; state still moves */ }
  }, []);
  const back = useCallback(() => {
    const prev = stack.current.pop() ?? fallback;
    setHash(prev);
    try { if (window.location.hash !== prev) window.history.pushState(null, '', prev); } catch { /* as above */ }
  }, [fallback]);
  return { hash, go, back };
}
export function parseHash(hash: string): string[] { return hash.replace(/^#\/?/, '').split('/').filter(Boolean); }

/* --------------------------------------------------------------- toasts */
type Listener = (msgs: { id: number; text: string }[]) => void;
let toastSeq = 0; let toasts: { id: number; text: string }[] = []; const toastSubs = new Set<Listener>();
export function toast(text: string): void {
  const t = { id: ++toastSeq, text }; toasts = [...toasts, t]; toastSubs.forEach(l => l(toasts));
  setTimeout(() => { toasts = toasts.filter(x => x.id !== t.id); toastSubs.forEach(l => l(toasts)); }, 4200);
}
export function Toasts() {
  const [list, setList] = useState(toasts);
  useEffect(() => { toastSubs.add(setList); return () => { toastSubs.delete(setList); }; }, []);
  return <div className="cm-toasts" aria-live="polite">{list.map(t => <div key={t.id} className="toast">{t.text}</div>)}</div>;
}

/* --------------------------------------------------------------- modals */
export function Modal({ className, onClose, children }: { className: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return <dialog ref={ref} className={className} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>{children}</dialog>;
}

/** Read a standard <form> into a plain record. */
export function formValues(form: HTMLFormElement): Record<string, string> & { all: (name: string) => string[] } {
  const fd = new FormData(form); const out: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string' && !(k in out)) out[k] = v; });
  return Object.assign(out, { all: (name: string) => fd.getAll(name).filter((v): v is string => typeof v === 'string') });
}
