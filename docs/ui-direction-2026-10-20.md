# UI direction: clear, easy and inviting

20 October 2026. Cal asked for a standing focus on making RELAY's interface
clear and easy to use, and professional and inviting enough that people choose
to use it rather than avoid it. This note sets the direction, records what a
review of the current screens found, and lists the improvements in priority
order. It does not replace the approved designs in `designs/` and
`docs/designs/`; it refines how they are applied.

## Direction

1. **The next action is obvious.** Every screen has one primary action, in
   gold, worded as a verb the user would say ("Send defect", "Check defect").
   Secondary actions are quieter. Nothing important needs a hunt.
2. **Words people read, labels they scan.** Buttons, tabs and anything tapped
   use the sans face in sentence case at a readable size. The small mono
   capitals stay for what they do well: section labels, column headers, status
   tags and references (`011LME`, `ISS-0`). This keeps the approved
   "structured typography" identity while making controls easier to read.
3. **Numbers that matter are big.** Counts on the office desk are the first
   thing a manager reads, so they are large and calm, with the explanation
   underneath.
4. **Site first on the phone.** Gloves, glare and one hand: large targets
   (48px minimum, 60px+ for the camera), the camera as the most prominent
   control on a defect, and no browser-default widgets.
5. **Calm, honest feedback.** Plain English, correct grammar and plurals, and
   status words that never overstate (received is not delivered). Empty
   states say what will appear and what to do next.
6. **One look across the product.** Same palette, type and controls on the
   phone, the office desk and Compliance, in light and dark.

## What the review found

Screens checked in Chromium at 390px (phone) and 1440px (desk), light and dark,
with local sign-in and seeded example data.

- Office controls (tabs, top-bar links, buttons, filters) were all 10–11px
  mono capitals with wide tracking. Readable, but slow to scan and it made
  every control look like a label. Stat numbers were 18px mono and did not
  stand out.
- The defect form showed the browser's own "Choose Files / No file chosen"
  control for the most important step. The report editor's camera control
  was a small mono caption in a dashed box whose photo input could not be
  reached from a keyboard.
- The theme control read "AUTO" with nothing saying what it controlled.
- Copy slips: "1 item need attention", "1 issues".
- The office opens with an empty middle column ("Select a project…") taking a
  third of the screen.
- The report editor is one long scroll; the open card, the check list and the
  signature all compete. The kind picker repeats itself ("Selected: DEFECT").
- The engineer bottom navigation is text-only.

## Done in this change

- Office desk: tabs, top-bar links, buttons and filter chips in the sans face,
  sentence case, 13–14px (12px on the phone tab bar, was 9px); the active tab
  is weighted. Section labels, table
  headers, tags and references are unchanged. Stat numbers are 28px.
- Photo buttons on the defect form and report cards are large, gold-outlined
  buttons with a camera icon and plain words ("Take a photo", then "Add
  another photo"). The browser's file control is hidden but the input stays
  focusable, so a keyboard can open it.
- Theme control shows an icon and the current setting ("Auto", "Light",
  "Dark") in sentence case; the icon drops below 360px wide.
- Fixed "1 item needs attention" and "1 issue" plurals.

Verified: `npm run typecheck`, `npm test` (145 package + 48 web tests),
`npm run build`, and before/after screenshots of the engineer home, defect form,
report editor, office desk and admin in light and dark. The defect flow in
`scripts/verify-engineer-layout.mjs` (photo upload, no horizontal overflow at
three widths, send and retry) passed. That script is stale on `main`: it waits
for an "On site today" heading and a "Team & contacts" button that no longer
exist, and with those two lines skipped it fails at the later "View project
issues" step both before and after this change. Not checked: a physical phone,
iOS Safari, a live tenant.

## Next, in priority order

1. **Office landing.** Done in UI-1: until a project is chosen, the office
   position takes the full width beside the project list.
2. **Report editor flow.** Collapse cards that are not being edited, drop the
   repeated "Selected" line, and make "Check & send" a clear final step with a
   sticky action that never covers the field being typed in.
   Done 20 October (see `docs/progress.md`, UI-2).
3. **Engineer navigation.** Done in UI-3: each entry has a line icon with its
   label (icon over label on the phone bar), the current view is weighted with
   a gold mark and a tinted tile, all five entries sit on one row down to
   320px, and the page padding clears the bar.
4. **Empty states that invite action** across Inbox, Issues, Variations and the
   engineer "Came back from the office" panel.
5. **Fix the stale layout check** so it runs again, and add the office desk at
   1440px to it.
6. **Compliance on the shared workspace styles**, so both companies get the same
   controls (already listed as open work).
7. **Prototype banner.** Keep it while the data is example data; when the pilot
   is live, a small "Pilot" mark in the top bar is enough.
