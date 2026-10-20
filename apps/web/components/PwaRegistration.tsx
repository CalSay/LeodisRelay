"use client";

import { useEffect } from "react";
import { forgetCopies } from "@/lib/siteInfoClient";

/** Registers only the app-shell cache. Report data and evidence stay private. */
export function PwaRegistration() {
  useEffect(() => {
    const signout = (event:Event) => {
      const form=event.target;
      if(form instanceof HTMLFormElement && new URL(form.action).pathname === '/api/auth/signout') { sessionStorage.removeItem('relay-offline-principal'); forgetCopies(); }
    };
    document.addEventListener('submit',signout);
    if (process.env.NODE_ENV === 'production' && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => document.removeEventListener('submit',signout);
  }, []);
  return null;
}
