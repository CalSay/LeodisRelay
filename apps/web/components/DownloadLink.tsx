'use client';

import { useState, type ReactNode } from 'react';
import { failure } from '@/lib/failure';

/**
 * A download that says when it did not work.
 *
 * A plain `<a download>` that the server refuses (signed out, the server
 * down) ends as "Failed" in the browser's download bar, or as a file of error
 * text, with nothing on the page. This fetches the file first: when it comes,
 * it is saved under the server's file name as before; when it does not, the
 * reason shows beside the link. The address stays on the link, so it still
 * works without JavaScript and from "Save link as".
 */
export function DownloadLink({ href, what, className, children, ...rest }: {
  href: string;
  /** The file, for the message: "spreadsheet", "PDF". */
  what: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function save(event: React.MouseEvent<HTMLAnchorElement>) {
    // A modified click (new tab, save as) is the browser's to handle.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true); setProblem('');
    try {
      const response = await fetch(href, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw failure(response.status, body, `The ${what} could not be downloaded.`);
      }
      const blob = await response.blob();
      const name = /filename="?([^";]+)"?/i.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? '';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = name;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setProblem(e instanceof Error && !(e instanceof TypeError) ? e.message : `No connection, so the ${what} could not be downloaded. Try again when there is signal.`);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <a href={href} download className={className} onClick={save} aria-busy={busy || undefined} {...rest}>{children}</a>
    {problem && <span className="download-problem" role="alert">{problem}</span>}
  </>;
}
