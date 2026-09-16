'use client';
import type { ReactNode } from 'react';

/**
 * The office's status vocabulary: one small boxed mark per record, and the
 * separators that group a list by it. Every mark carries a label, so the
 * colour is never the only signal.
 */
export type MarkKind = 'urgent' | 'action' | 'sync' | 'done' | 'none';

const GLYPH: Record<MarkKind, ReactNode> = {
  urgent: <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.2 14.3 13.4H1.7L8 2.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 6.4v3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.7" r=".95" fill="currentColor" /></svg>,
  action: <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="8" cy="12.6" r="1.15" fill="currentColor" /></svg>,
  sync: <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 6.5A5 5 0 0 0 3.6 5M3 9.5A5 5 0 0 0 12.4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M3.3 2.6v2.6h2.6M12.7 13.4v-2.6h-2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  done: <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.2 8.4 6.5 11.6 12.8 4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  none: null,
};

export const MARK_LABEL: Record<MarkKind, string> = {
  urgent: 'Urgent',
  action: 'Action needed',
  sync: 'SharePoint needs attention',
  done: 'Complete',
  none: 'Nothing due',
};

export function Mark({ kind, label, size }: { kind: MarkKind; label?: string; size?: 'sm' | 'md' }) {
  const text = label ?? MARK_LABEL[kind];
  return <span className={`ro-mark ro-mark-${kind} ${size === 'sm' ? 'sm' : ''}`} role="img" aria-label={text} title={text}>{GLYPH[kind]}</span>;
}

/** A coloured separator line that names a group: "Urgent · 3". */
export function Band({ kind, label, count, right }: { kind: MarkKind; label: string; count?: number; right?: ReactNode }) {
  return <div className={`ro-band ro-band-${kind}`}><span>{label}{count !== undefined && ` · ${count}`}</span>{right}</div>;
}

/** A light block heading that names a record type inside a mixed list. */
export function GroupHead({ label, right }: { label: string; right?: ReactNode }) {
  return <div className="ro-grouphead"><span>{label}</span>{right !== undefined && <i>{right}</i>}</div>;
}

/**
 * The reference stub card. The code sits in its own tinted stub so codes line
 * up down a list; the title takes the middle; the status mark has a fixed
 * slot. Everything that repeats in a register uses this one shape.
 */
export function StubCard({ href, onClick, project, code, title, sub, aside, mark, markLabel, on, quiet, slim }: {
  href?: string; onClick?: () => void; project: string; code: string; title: ReactNode; sub?: ReactNode; aside?: ReactNode;
  mark: MarkKind; markLabel?: string; on?: boolean; quiet?: boolean; slim?: boolean;
}) {
  const cls = `ro-card ${on ? 'on' : ''} ${quiet ? 'quiet' : ''} ${slim ? 'slim' : ''} ${aside ? 'with-aside' : ''}`;
  const body = <>
    <span className="ro-stub"><small>{project}</small><b>{code}</b></span>
    <span className="ro-card-body"><span className="ro-card-title">{title}</span>{sub && <span className="ro-card-sub">{sub}</span>}</span>
    {aside && <span className="ro-card-aside">{aside}</span>}
    <span className="ro-card-mark"><Mark kind={mark} label={markLabel} size={slim ? 'sm' : 'md'} /></span>
  </>;
  if (href) return <a className={cls} href={href} aria-current={on ? 'true' : undefined}>{body}</a>;
  return <button type="button" className={cls} onClick={onClick} aria-pressed={on}>{body}</button>;
}

export function CardList({ children }: { children: ReactNode }) {
  return <div className="ro-list">{children}</div>;
}
