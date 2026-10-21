'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { GLOSSARY, GUIDE, addedLabel, canOpen, linksFor, markSeen, seenKey, whatsNewFor, type HelpTab } from '@/lib/helpGuide';
import { backLabel, safeViewReturn, withViewReturn } from '@/lib/viewNavigation';
import { SEEN_EVENT, loadSeen, newToRelay } from './useWhatsNew';

/**
 * Help and what's new: how RELAY works for the engineer on site and for the
 * office, what each status word means, and what has been added lately with a
 * link to try it. Reads nothing from the server; the "seen" list is kept on
 * the device, per person, and only decides which entries say "New".
 */

const TABS: [HelpTab, string][] = [['site', 'On site'], ['office', 'In the office']];
const SHOWN = 6;

export function HelpPage({ initialTab, returnTo }: { initialTab: HelpTab; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const router = useRouter();
  const [tab, setTab] = useState<HelpTab>(initialTab);
  const [all, setAll] = useState(false);
  // What this person had seen when the page opened, so entries stay marked
  // "New" for the whole visit even though they are recorded as seen at once.
  const [seenBefore, setSeenBefore] = useState<Set<string> | null>(null);
  // Someone opening Help for the first time is new to RELAY: every entry would
  // say "New", so none does, and How it works comes first.
  const [newcomer, setNewcomer] = useState(false);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : '/engineer');

  useEffect(() => { setNewcomer(newToRelay(principal?.id)); setSeenBefore(loadSeen(principal?.id)); }, [principal?.id]);
  const entries = whatsNewFor(tab);
  useEffect(() => {
    if (!principal || !seenBefore) return;
    try {
      const key = seenKey(principal.id);
      localStorage.setItem(key, JSON.stringify(markSeen(loadSeen(principal.id), entries)));
      window.dispatchEvent(new Event(SEEN_EVENT));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, principal?.id, seenBefore]);

  const q = new URLSearchParams({ for: tab });
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/help?${q}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);
  // A printed copy carries the whole list.
  useEffect(() => {
    const unfold = () => setAll(true);
    window.addEventListener('beforeprint', unfold);
    return () => window.removeEventListener('beforeprint', unfold);
  }, []);
  // Pages opened from here come back to this tab, not to wherever Help was opened from.
  const self = `/help?for=${tab}`;
  const go = (href: string) => href.startsWith('/office') || href === '/engineer' ? href : withViewReturn(href, self);

  const isNew = (id: string) => seenBefore !== null && !newcomer && !seenBefore.has(id);
  const fresh = entries.filter(e => isNew(e.id)).length;
  // The latest few, and anything new to this person however far down it is.
  const shown = all ? entries : entries.filter((e, i) => i < SHOWN || isNew(e.id));
  const today = new Date().toISOString().slice(0, 10);

  const whatsNew = <section id="help-new" className="help-section" aria-labelledby="help-new-title">
    <div className="help-section-title"><h2 id="help-new-title">What&rsquo;s new</h2>{fresh > 0 && <span className="tag tag-draft">{fresh} new to you</span>}</div>
    <ul className="help-new">
      {shown.map(e => <li key={e.id} className={isNew(e.id) ? 'is-new' : ''}>
        <div className="help-new-meta"><time dateTime={e.added}>{addedLabel(e.added, today)}</time>{isNew(e.id) && <span className="tag tag-draft">New</span>}</div>
        <h3>{e.title}</h3>
        <p>{e.text}</p>
        {e.link && canOpen(e.link.href, manager) && <Link className="help-try" href={go(e.link.href)}>{e.link.label} &rarr;</Link>}
      </li>)}
    </ul>
    {entries.length > shown.length && <button type="button" className="help-more help-noprint" onClick={() => setAll(true)}>Show all {entries.length}</button>}
  </section>;

  const howItWorks = <section id="help-how" className="help-section" aria-labelledby="help-how-title">
    <div className="help-section-title"><h2 id="help-how-title">How it works</h2></div>
    <div className="help-guide">
      {GUIDE[tab].map(s => <article key={s.id} className="help-card">
        <h3>{s.heading}</h3>
        {s.ordered
          ? <ol className="help-steps">{s.steps.map(step => <li key={step}>{step}</li>)}</ol>
          : <ul className="help-points">{s.steps.map(step => <li key={step}>{step}</li>)}</ul>}
      </article>)}
    </div>
  </section>;

  const jumpNew = <a href="#help-new">What&rsquo;s new</a>, jumpHow = <a href="#help-how">How it works</a>;

  return <main className="eng-page help-page">
    <Link href={back} className="back help-noprint">&larr; {backLabel(back)}</Link>
    <header className="help-head">
      <p className="lbl">Help</p>
      <h1>How RELAY works</h1>
      <p className="help-intro">{tab === 'site'
        ? 'Everything you send from site in one place: what to tap, what happens next, and what the words on the screen mean.'
        : 'What arrives from site, what needs you, and what the words on the screen mean.'}</p>
      {newcomer && <p className="help-intro help-first">New to RELAY? Start with How it works, just below.</p>}
      <div className="help-tabs help-noprint" role="group" aria-label="Show help for">
        {TABS.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => { setTab(key); setAll(false); }}>{label}</button>)}
      </div>
      <nav className="help-jump help-noprint" aria-label="On this page">
        {newcomer ? <>{jumpHow}{jumpNew}</> : <>{jumpNew}{jumpHow}</>}<a href="#help-words">What the words mean</a><a href="#help-where">Where to find things</a>
      </nav>
    </header>

    {newcomer ? <>{howItWorks}{whatsNew}</> : <>{whatsNew}{howItWorks}</>}

    <section id="help-words" className="help-section" aria-labelledby="help-words-title">
      <div className="help-section-title"><h2 id="help-words-title">What the words mean</h2></div>
      <div className="help-glossary">
        {GLOSSARY.map(g => <article key={g.heading} className="help-card">
          <h3>{g.heading}</h3>
          <dl>{g.terms.map(t => <div key={t.term}><dt>{t.term}</dt><dd>{t.meaning}</dd></div>)}</dl>
        </article>)}
      </div>
    </section>

    <section id="help-where" className="help-section" aria-labelledby="help-where-title">
      <div className="help-section-title"><h2 id="help-where-title">Where to find things</h2></div>
      <div className="help-links">
        {linksFor(tab).filter(l => canOpen(l.href, manager)).map(l => <Link key={l.href} href={go(l.href)} className="help-link"><b>{l.label}</b><span>{l.text}</span></Link>)}
      </div>
    </section>

    <p className="help-foot">RELAY is in its pilot. Reports for SharePoint projects are filed there; nothing is emailed from RELAY yet, so tell the project manager yourself if something cannot wait.</p>
  </main>;
}
