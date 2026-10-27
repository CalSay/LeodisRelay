# Style drafts (27 October 2026)

Cal: "The UI is so cluttered and messy everywhere... fully draft 3 different
styles focusing on making things easy for users while maintaining the
information that we need."

Three drafts for Cal to choose from. Each is a stylesheet laid over the real
app at render time; nothing in `apps/web` changes, and `globals.css` on main
is untouched until Cal picks.

- `_base.css`: shared by all three. Plain-word labels instead of letter-spaced
  mono capitals, references in grey, the prototype strip in plain words.
- `calm.css` (A): fewer boxes; sections are space, a heading and a rule; status
  is a dot and a word.
- `panels.css` (B, recommended): white panels with soft edges on a grey page;
  one heading per panel; soft filled status pills.
- `board.css` (C): dark top bar, solid dark section bars, solid status blocks,
  larger type; for a phone in sunlight.

Render (after `npm test && npm run build`):

    node design/style-drafts/shoot.mjs <out-dir> [current calm panels board]

It seeds the busy-projects data set, signs in as Sam (engineer, 390 px) and
the office manager (1440 px), and saves light and dark screenshots of seven
screens per style. `ONLY=eng-site,office-issues` limits the screens.

Verified: the seven screens render in all four looks, light and dark, with
seeded data. Not verified: contrast (axe), other screens, real phones. The
chosen style still has to be built into the app's own CSS properly.
