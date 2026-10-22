"use client";

import { use, useState } from "react";
import { EntryFrame } from '@/components/EntryFrame';

/**
 * Local sign-in, for development only.
 *
 * Deliberately plain and deliberately labelled. It exists so the prototype can
 * be worked on before a tenant administrator has created the app registration,
 * not as an alternative to signing in.
 */
export default function LocalSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; returnTo?: string }>;
}) {
  const { state = "", returnTo = "/" } = use(searchParams);
  const [name, setName] = useState("");

  return (
    <EntryFrame><div className="entry-login entry-local">
      <p className="entry-kicker">DEVELOPMENT ONLY</p>
      <h1>Local sign-in</h1>
      <p className="entry-copy">No identity is checked. Type any name to carry on.</p>

      <form action="/api/auth/callback" method="GET">
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="field">
          <label htmlFor="who">Who are you?</label>
          <input
            id="who"
            name="code"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="D. Hartley"
            autoFocus
          />
          <p className="hint">
            This name is recorded as the author of anything you capture. Use different names to
            try the office checking someone else&apos;s work.
          </p>
        </div>
        <button className="entry-cta" type="submit" disabled={name.trim() === ""}>
          Continue
        </button>
      </form>
    </div></EntryFrame>
  );
}
