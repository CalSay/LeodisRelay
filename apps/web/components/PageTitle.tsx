'use client';
import { useEffect } from 'react';

/**
 * Names the browser tab for screens that change without a new route (the
 * engineer views, the office desk tabs) and client-rendered detail pages, in
 * the same "Page · RELAY" form the server pages use. These routes have no
 * title of their own, and Next can stream the plain default ("RELAY") in after
 * this screen has mounted, so the name is put back over that default only:
 * a page being navigated to keeps the title it brings.
 */
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    const wanted = title ? `${title} · RELAY` : 'RELAY';
    document.title = wanted;
    const apply = () => { if (document.title === 'RELAY') document.title = wanted; };
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    // A next route with no title of its own must not keep this screen's name.
    return () => { watch.disconnect(); if (document.title === wanted) document.title = 'RELAY'; };
  }, [title]);
  return null;
}
