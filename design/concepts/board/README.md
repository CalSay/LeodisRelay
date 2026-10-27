# Concept C: Control board

**The idea.** The office runs the work like the board on a site cabin wall:
everything visible at once, sorted by state, so movement is obvious at a
glance. The engineer gets a few huge, unmistakable buttons that work with
gloves on and in sunlight. Charcoal chrome, white panels, solid status blocks
(red late, amber waiting on the office, blue in progress, green done), every
figure in Plex Mono, bright Leodis gold for the one main action.

Open `index.html` (reads `../data.js`, the busy-projects seed). Screens:
`#eng-home`, `#eng-update`, `#eng-issue`, `#office-home`, `#office-issues`,
`#office-report`, `#office-weekly`. Render with
`node design/concepts/shoot.mjs <out> board`.

## Screen by screen

**Engineer home (Site).** A launcher instead of a list. A dark band carries the
project and a Switch button. Below it: one full-width gold tile "Today's update"
(cards so far and when it was saved), then four big square tiles: Defect,
Variation, Issues here (with count and how many are past their date) and Sent
back to you (red, with count). Sent-back fixes follow as bold cards with the
office's words in full and one "Open and answer" button. Notes for the next
visit sit at the bottom. Dropped from this screen: Since your last visit,
Unfinished reports list, This project links, Your week and help (they move to
the Reports and Search tabs).

**Site update editor.** Built for gloves. Each card opens as a four-step
stepper (Where, What happened, Photos, What kind). Where is a grid of recent
places as big buttons, Photos has a large dark "Add photo" square, and the card
kind is four big buttons. Finished cards collapse to blocks with their photos
and an Add button. Four large dashed "+ Progress / Defect / Variation / Access"
buttons add a card. A 64px gold "Check & send" bar is always at the bottom,
with the card and photo count and "Sends when there is signal".

**Issue page.** A status track across the top (Raised, Confirmed, Assigned,
Fixed, Checked) shows where it stands. If the office sent it back, their words
are in a solid red block first. A big facts block (Where, What needs doing, Who
is fixing it, Due with days late in red), then the history. One giant gold
"Mark fixed" button with a camera button beside it.

**Office overview.** A left sidebar app (Overview, Issues, Reports, Variations,
Weekly, Team, then the projects). Six figure tiles across the top: reports
today, not read yet, fixes to check, issues overdue, no one assigned,
variations waiting. Then "Who was on site": a matrix of projects by the last
ten working days with a lettered trade block for each trade that sent an
update, today highlighted, and open/late/to-check figures at the end of each
row. Below, "Act now" (oldest fixes to check, unassigned issues, variations
with work done but not instructed, each with its action button) beside "Coming
in" (today's reports, unread ones marked).

**Issues.** A board with five columns: New (to confirm), Assigned, In
progress, Fixed to check, Closed (last 30 days). Each column header shows its
count, and a strip under it shows how many are late and how many have no
owner (or how long the oldest fix has waited). Cards show trade, project and
number, age or days late, the description, owner (red "No one assigned" when
empty) and place; late cards have a red edge. Project filter works; trade,
company and place filters, a Table view, Spreadsheet and Snag list are shown.

**Reports (inbox and reader).** Split view: reports grouped by day on the left
with unread dots and a strip of coloured marks for each card's kind; the open
report on the right with the four stages as blocks (Received, PDF, Filed to
SharePoint, Seen), a count of each kind, then the cards as a two-column grid.
Each card shows its place, kind, text, what is needed and by whom, photos, and
the issue or variation it raised with that record's state.

**Weekly.** Rebuilt as a one-project dashboard instead of the old form plus
table. Six figures (visits, issues raised, closed, open now, overdue now with
change on last week, variations raised), issues raised and closed by week for
six weeks, overdue issues at the end of each week, who was on site by trade
and day for two weeks, variations (this week, waiting, instructed value), the
week's site updates in brief, and where the open issues are (top places, late
part in red). "Client view" and "PDF for the client" give the version to send.

## What would it take to build

Mostly front-end: a new office shell (sidebar layout), a board component for
issues, the coverage matrix (the site coverage page already computes the same
data), and SVG charts on the weekly page (figures already exist in
lib/weeklySummary and lib/issueTrend). The engineer side needs a new home
launcher and the stepper editor over the existing draft model. No data model
changes. Roughly 3 to 4 weeks of focused work with browser checks, screen by
screen.

## Not checked

Accessibility checker, keyboard use, real phones in sunlight, and how the
board behaves with filters and drag to move (shown, not built). Seeded text is
jumbled sample data.
