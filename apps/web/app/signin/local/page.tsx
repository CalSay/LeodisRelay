"use client";

import { use, useState } from "react";

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
    <main className="wrap" style={{ maxWidth: 460 }}>
      <div className="pagehead">
        <div>
          <h1>Local sign-in</h1>
          <p className="sub">Development only — no identity is checked</p>
        </div>
      </div>

      <form action="/api/auth/callback" method="GET" style={{ marginTop: 24 }}>
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
            This name is recorded as the author of anything you capture, so use different names to
            test review and verification.
          </p>
        </div>
        <button className="btn-primary btn-wide" type="submit" disabled={name.trim() === ""}>
          Continue
        </button>
      </form>
    </main>
  );
}
