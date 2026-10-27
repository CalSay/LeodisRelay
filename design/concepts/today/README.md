# Concept A, "Today"

The idea is task first. Both roles open on a short list of what needs them now, in order, and everything else is one tap away. A screen only shows what helps with the next decision.

Open `index.html#<screen>` in a browser. The page reads `../data.js`, which is the busy-projects seed, so every reference, name, date and count is computed from the records. Screenshots are in `ui-review/style-drafts-v2/today/` in the project files.

## Screens

**Engineer home (`#eng-home`)**
- It is now called "Today at Tetley Hall". There is one big gold button, "Carry on today's update", showing how many cards and photos it has and when it was last saved.
- "Needs you" comes next. The office's own words sit at the top of each card, then the issue, then one button: answer with a photo.
- Two quick buttons follow, Defect and Variation.
- "Around you" ends the page. It is one line with three counts: open issues on the site, how many are in his trade and how many are past their date.
- Dropped from the home page: unfinished drafts (they go behind Reports), since your last visit, the project links, site notes, my week and help. The bottom bar has four items: Today, Issues, Reports and More.

**Site update (`#eng-update`)**
- One card is open at a time, in big type.
- The card's kind is a four-way switch (Progress, Defect, Access, Variation).
- Photos come first, with a large Add photo tile.
- Recent places are one-tap chips under "Where on site?".
- The other cards fold to single ticked rows.
- A three-step progress line (Cards, Check, Send) runs along the top, and a fixed "Check and send 3 cards" button sits along the bottom.

**Issue (`#eng-issue`)**
- When the office sent the issue back, its words lead the page.
- A short fact list follows: Where, What to do, Who, By when (with days late).
- Then one big "Add photo and mark as fixed", with "Add an update without fixing" as the quiet second choice.
- History is a short timeline.

**Office today (`#office-home`)**
- The page is a triage queue beside a detail panel.
- The queue has four jobs, oldest first, each with an honest count from the data:
  - Read new reports (unseen in the last two weeks)
  - Check fixes put forward
  - Give issues an owner
  - Price or instruct variations (work already done comes first)
- The selected item opens on the right with its decision inline. For a fix to check, that is "Fixed, close it" or "Not finished, send back" with a note.
- A slim strip at the top keeps each project's last visit, open, overdue and variations waiting in view without making it the focus. It replaces "Where each project stands", the action columns and "Also needs attention".

**Issues (`#office-issues`)**
- This is still a full register, because the office needs one.
- Saved views run along the top as tabs: All open, Overdue, To check, Needs an owner, By company.
- Filters are three quiet controls.
- Columns are cut to Ref, Issue, Project, Who's fixing, Due and State.
- Clicking a row opens it in a side panel with Chase, New date and Reassign, plus its history, so the page never has to change.

**Report reading (`#office-report`)**
- The report reads as a clean document: the visit date as the heading, then who sent it and when, then a one-line summary of its cards, photos and what it raised.
- Each area of site has its own section, with "Needs doing by …" boxes and a photo strip.
- The side column shows what the report raised, with live status, where it went (received, PDF, SharePoint, seen) and the previous update from the same trade.
- A bar across the top steps through the unread reports: "Unread report 2 of 21", Previous, Skip, and "Mark as read, next".

**Week in review (`#office-weekly`)**
- This replaces the old weekly summary form completely.
- It opens with a plain-English paragraph written from the figures. Five numbers follow, each with its change on last week.
- "Done this week, by area" groups the progress lines by place.
- A six-week chart compares issues raised with issues closed, and a variations list shows each one's state and value.
- A "Send to the client" panel shows the project manager and client, a PDF preview, Download PDF and Copy the summary, and the other projects' week at a glance.
- Month would be the same layout over four or five weeks.

## Merged or dropped
- The office overview's three columns of actions, "Also needs attention" and the Attention bell all become the one queue.
- The weekly summary's form controls and title block go. The project picker and week stepper sit in the page header.
- On the engineer's side, Unfinished reports, Since your last visit, This project and More on this project come off the home page. Reports, Photographs, Site notes, My week, Search and Help sit behind Reports and More.
- Nothing the office relies on is lost. Each figure moved to the strip, the queue, the register or Week in review.

## Building it
Most of the data already exists in the app: the attention model, notSeen, checkFix, the issue query and the weekly and month summaries. The work is mostly layout:
- Engineer home: a new EngineerWorkspace home view. About 2 to 3 days.
- Editor: one card at a time and the step line. About 3 to 4 days, plus the browser checks that depend on today's editor.
- Office Today queue and detail panel: replaces the desk overview. About 4 days.
- Register side panel. About 2 days.
- Report reader as a document with "next unread". About 2 days.
- Week in review: the auto paragraph and chart are new, and the PDF template needs matching. About 3 to 4 days.

Many `scripts/verify-*.mjs` checks name today's headings and rows and would need updating.

## Not verified
No contrast (axe) check, no real phone, and no keyboard pass. The prototype has static screens: buttons don't do anything. The seeded text is jumbled (descriptions and actions don't match), which is the seed, not the design. Only one of Sam's fixes qualifies as sent back in this seed, so "Needs you" shows one.
