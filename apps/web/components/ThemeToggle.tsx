"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";

export const THEME_KEY = "relay-theme";

const ORDER: ThemeChoice[] = ["auto", "light", "dark"];

/**
 * Theme control.
 *
 * Three states rather than two, and the current one is named rather than
 * implied by an icon. "Auto" is a real setting people want back once they have
 * left it, and an icon alone cannot say whether a sun means "you are in light"
 * or "switch to light" — an ambiguity worth a few pixels of text to avoid.
 *
 * Applying a choice stamps data-theme on the root element; auto removes it and
 * lets prefers-color-scheme decide. The stylesheet handles all three.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  // Adopt whatever the pre-paint script already applied, so the button never
  // disagrees with the screen.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY) as ThemeChoice | null;
      if (stored === "light" || stored === "dark") setChoice(stored);
    } catch {
      // Private browsing or blocked storage. Auto is a fine place to be.
    }
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
    setChoice(next);
    applyTheme(next);
    try {
      if (next === "auto") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // The theme still applies for this session even if it cannot be stored.
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="themebtn"
      aria-label={`Appearance: ${choice}. Change appearance.`}
    >
      {choice}
    </button>
  );
}
