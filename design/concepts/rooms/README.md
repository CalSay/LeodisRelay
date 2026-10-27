# Concept B: Site rooms

Drafted 27 October 2026 for Cal's second ask: complete freedom to rethink
every element. This is a clickable prototype over the busy-projects seed
(`../data.js`), not part of the app. Open `index.html` and use the hash routes:
`#eng-home`, `#eng-update`, `#eng-issue`, `#office-home`, `#office-issues`,
`#office-report`, `#office-weekly`.

## The idea

Every project is a **room**: a shared, living timeline of what happened on
site, told mostly through photos and short posts, like a site diary everyone
can see. Conversations about an issue happen **on the issue**, as a thread
between the office and the engineer, not as separate events scattered over
pages. People think in **places** (Level 2 west corridor, Plant room), so
places are a first-class way in: issues are grouped by place, places are
chips you tap, and the weekly summary is told place by place.

Look: warm paper, rounded cards, people shown as initials coloured by trade
(Electrical amber, HVAC blue, P&H teal, office purple), a timeline rail, and
photo-led layouts. Gold is kept for the one main action on each screen;
red, amber and green only carry state. Light and dark are both designed.

## Screen by screen

**Engineer home (the room).** Replaces the Site page's stack of tiles and
sections. Top: switch between your rooms with one tap. Then one compose card:
"What did you do today?", today's update with its photos and a single big
"Carry on with today's update" button, and quick Progress, Defect and
Variation buttons. Next, "The office replied": fixes sent back appear as
messages from the office with Reply and Send a photo. Below, "Today in this
room": what Hana and Pat posted today and the issues they raised, then
yesterday. Dropped from the first screen: Since your last visit,
Inspections, This project links, Your week and help (they move to the
Places and My week tabs).

**Site update editor (composing a post).** Each card is a photo-led entry:
photo tiles first with a big "Add photo" tile, then a type chip and a place
chip, then the text, then what needs doing and who. "Add to this update"
gives four large type buttons and the places you've worked in this room as
chips. One sticky "Send today's update" bar says how many cards and photos
and who it goes to. The two-step Cards / Check & send tabs are gone: the
page is the check.

**Issue page (a conversation).** The office's latest message is pinned at
the top, because that is why the engineer opened it. Then the issue, its
place and trade, four facts (needs doing, who is fixing it, fix by with
days late, raised by you), and "What has happened" as a chat thread: your
raise with its photo, the office confirming and passing it to the trade as
small system lines, the fix put forward with its photo, the office sending
it back. A sticky "Mark as fixed, with a photo" and a reply box.

**Office home (the rooms).** Replaces the "Office position" tables. One
large card per room: a strip of the latest photos by place, a one-line
"what changed" ("Today: 2 site updates from Hana Duct and Pat Pipe, 4
defects found"), who is on site, and six honest counts (new reports, open,
late, fixes to check, nobody owns, variations to price), each linking on.
Beside it, "Waiting on you" gathers the office's jobs across rooms with the
split by room, and "Across all rooms" is the combined feed.

**Issues register (by place).** Left rail: room, show (open, late, fixed to
check, nobody owns it, closed lately) and trade, all with counts. Middle:
issues grouped by place, the places with the most late issues first, each
row with its state pill, owner, trade and fix-by date. A By place / Table
toggle keeps the flat register for people who want it. Right: the selected
issue's thread, with a reply box, "Change who fixes it" and "Mark as
checked".

**Report reading (a post, expanded).** Left: latest from site across rooms,
unopened ones dotted. Middle: the report as a post: who, where, when, a
summary of card types, photos and places, then each card with its photos
large beside it and, under defects and access cards, what it became (the
issue reference and its state now, or the variation and whether it is
priced). Right: "Where this report is" as steps (received, PDF made, filed
to SharePoint, seen by the office) and the same trade's previous update.
The old "Actions and decisions" summary that repeated the cards is gone.

**Weekly summary (the week at Tetley Hall).** Rebuilt as a client-ready
newsletter page, not a form and a table. A written lead paragraph with the
week's figures, a Monday to Sunday strip showing who was on site each day,
four figures, a photo grid, "What got done, place by place", issues found
and variations side by side, and "For next week" from the site notes and the
late count. Last week by default, with This week so far and Month as
switches, Download PDF and Send to the project manager.

## Kept, merged, dropped

- Kept everywhere: projects, last visit, open and late issues, fixes to
  check, unassigned issues, variations waiting, unopened reports, report
  contents, issue history and the weekly figures.
- Merged: Inbox and report reader into Reports; Issues by company stays a
  filter (owner) rather than its own page in this draft; Site coverage's
  "who was on site" lives in each room card and in the week strip.
- Dropped from first screens: Since your last visit, Inspections links and
  This project links on the engineer home.
- Not drawn: Places tab, My week, Variations page, search results, Team,
  Admin, inspections. They would follow the same patterns.

## What it would take to build

- New shared components: avatar by trade, place chip, photo strip, post,
  thread bubble, sticky action bar. Most data already exists: issue events
  are the thread, report cards are the posts.
- New queries: a per-room timeline (reports plus issue events, newest
  first), issues grouped by place, and the week strip by day and author.
- The engineer reply box needs a new event kind ("message") on issues; today
  only the office's send-back note carries words.
- Real photos would replace the tinted placeholders; thumbnails need a
  small-image route so strips stay fast on a phone.
- Roughly: engineer home and issue thread first (one to two PRs each), then
  office rooms and issues by place, then the week page and its PDF.

Not checked: contrast with axe, real phones, screen readers, other screens.
Seeded text is jumbled by the seed (descriptions and actions don't match);
that is the data, not the design.
