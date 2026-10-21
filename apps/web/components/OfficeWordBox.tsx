"use client";
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { OfficeWord } from '@/lib/cameBack';
import { dayShort } from '@/lib/dates';

/**
 * What someone else last wrote on a record the engineer raised, at the top of
 * its page rather than folded in the history: who, when, and their words. A
 * note longer than three lines opens on those, with "Show all of it", so the
 * buttons under it stay on the first screen of a phone.
 */
export function OfficeWordBox({ word }: { word: OfficeWord }) {
  const note = useRef<HTMLParagraphElement>(null);
  const [all, setAll] = useState(false);
  const [long, setLong] = useState(false);
  const id = useId();
  useLayoutEffect(() => {
    const el = note.current;
    if (!el || all) return;
    // Once long, it stays long: the note on its own line may then just fit, and flipping back would loop.
    const measure = () => { if (el.scrollHeight > el.clientHeight + 1) setLong(true); };
    measure();
    // Again when the box changes size: a turned phone, or the font arriving.
    const watch = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, [all, word.note]);
  const who = `${word.by}${word.at ? ` wrote on ${dayShort(word.at)}` : ' wrote'}`;
  // Short, it is one paragraph led by who and when; long, who and "Show all of it" share a line above it.
  const split = long || all;
  return <section className="eng-word-box" aria-label={`Note from ${word.by}`}>
    {split && <div className="eng-word-head">
      <p className="eng-word-who">{who}</p>
      <button type="button" className="eng-word-more" aria-expanded={all} aria-controls={id} onClick={() => setAll(a => !a)}>{all ? 'Show less' : 'Show all of it'}</button>
    </div>}
    <p ref={note} id={id} className={`eng-word-note${all ? '' : ' cut'}`}>{!split && <span className="eng-word-who">{who}: </span>}{word.note}</p>
  </section>;
}
