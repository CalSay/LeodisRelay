# Redesign concepts (27 October 2026)

Cal, after the first style drafts: "You've essentially just taken what was
there and put a new coat on it. I want you to have the freedom to completely
change whatever elements you want for each draft."

Three clickable prototypes, each rethinking the same seven screens (engineer
home, site update, issue page; office home, issues, reading a report, weekly
summary). Static HTML over a snapshot of the busy-projects seed; nothing in
`apps/web` changes.

- `today/` (A): task first. Recommended as the base.
- `rooms/` (B): place first, photo timeline, issues as conversations.
- `board/` (C): big buttons on site, a board-and-dashboard office.

Each folder has its own README with the per-screen changes.

    npm test                                   # builds apps/web/.test-build
    node design/concepts/export-data.mjs       # writes data.js from the seed
    node design/concepts/shoot.mjs <out> today rooms board

Not verified: contrast (axe), real phones, screen readers. Buttons do not save.
