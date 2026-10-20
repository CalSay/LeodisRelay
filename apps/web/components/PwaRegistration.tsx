"use client";

import { useEffect } from "react";
import { OFFLINE_PERSON_KEY } from "@/lib/offlineStart";

/** Registers only the app-shell cache. Report data and evidence stay private. */
export function PwaRegistration() {
  useEffect(() => {
    const signout = (event:Event) => {
      const form=event.target;
      if(form instanceof HTMLFormElement && new URL(form.action).pathname === '/api/auth/signout') {
        // Signed out: the offline page no longer knows who to show work for, or which projects to offer.
        try {
          sessionStorage.removeItem('relay-offline-principal');
          for (const key of Object.keys(localStorage)) if (key === OFFLINE_PERSON_KEY || key.startsWith('relay-offline-projects:')) localStorage.removeItem(key);
        } catch {}
      }
    };
    document.addEventListener('submit',signout);
    if (process.env.NODE_ENV === 'production' && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => document.removeEventListener('submit',signout);
  }, []);
  return null;
}
