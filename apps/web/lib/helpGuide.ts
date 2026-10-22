/**
 * Help and what's new: a plain guide to RELAY for the two people who use it,
 * the engineer on site and the office, and a list of what has been added, so
 * a feature built this week is found by the people it was built for.
 *
 * Content lives here, not in the page, so a test can check every link goes
 * to a real page and every entry has a stable id. Each new feature adds one
 * entry to the top of `WHATS_NEW`; its `id` is what marks it "New" for each
 * person until they have opened Help, so never reuse or change an id.
 */

/** Who an entry or section is for. `all` shows on both tabs. */
export type HelpAudience = 'site' | 'office' | 'all';
export type HelpTab = Exclude<HelpAudience, 'all'>;

export interface WhatsNew {
  /** Stable: stored on each person's device as "seen". */
  id: string;
  /** The day it reached RELAY, `YYYY-MM-DD`. */
  added: string;
  audience: HelpAudience;
  title: string;
  text: string;
  /** Where to try it, if it has a page of its own. */
  link?: { label: string; href: string };
  /** About the safety, permits and deliveries records: shown only while the office has them on (featureSwitch.ts). */
  safetyRecords?: true;
}

/** Newest first. Only what has been merged; nothing promised. */
export const WHATS_NEW: readonly WhatsNew[] = [
  { id: 'issue-trend-to-check', added: '2026-10-22', audience: 'all', title: 'Issues over time shows what is waiting for the office',
    text: 'Issues over time now splits each week\'s open issues three ways: past target, fixed, to check, and the rest. Its headline, Open now, chart and week-by-week table say how many are fixed and waiting for the office to check ("119 of them are fixed and waiting for the office to check"), the same figure as the project sheet. Before, those sat in grey with the issues still to be done, so a growing list could not tell you whether site or the office was behind. Checked in a desktop browser and a phone-sized window, not on a real phone.',
    link: { label: 'Open Issues over time', href: '/issue-trend' } },
  { id: 'one-visit-a-day', added: '2026-10-22', audience: 'office', title: 'A visit is one person on site on one day',
    text: 'The office overview\'s "This week" and a project\'s Last visit now count one visit for each person on site each day, however many reports they send, and the Weekly summary says the same under Site reports ("10 visits over 4 days"). Before, an engineer who sent a site update and an inspection on the same day counted as two visits. While safety, permits and deliveries are switched off, a weekly safety or tower inspection is no longer counted as a visit on the overview, a project or Site coverage, as the Weekly summary already left it out; before, a project could show "14 visits this week" when its Weekly summary listed 11 site reports. A project\'s Project page also no longer counts withdrawn issues in "fixed, to check" or Closed, so it matches the project\'s figures; withdrawn issues are still listed under All. Checked in a desktop browser.' },
  { id: 'sent-back-fix-again', added: '2026-10-22', audience: 'office', title: 'See what you asked for when a fix comes back again',
    text: 'When a fix the office sent back as not finished is put forward again, checking it now shows who sent it back, when, and the reason they gave ("Sent back by Jo Office on Wed 21 Oct: ..."), above the engineer\'s new note and beside the new photo. So whoever checks it can see whether what was asked has been done, even if someone else sent it back. The Fixed, to check rows on the overview and in Attention say "put forward again" (or "put forward 3 times"), and the issue in the office says the same. A first attempt looks as before. Checked in a desktop browser, light and dark, and a phone-sized window.' },
  { id: 'inspection-tally-first', added: '2026-10-22', audience: 'office', title: 'An inspection shows what needs action first',
    text: 'When the office opens an inspection (in the Inbox or a project), a line under Inspection results now says how it went ("3 need action · 8 satisfactory · 1 not applicable") and only the checks needing action are listed, each with its issue. The satisfactory and not applicable checks fold under one button ("Show the 8 satisfactory and 1 not applicable checks"); a passing check the office has added a note to stays in view. The PDF and Full report still list every check. Checked in a desktop browser, light and dark, and a phone-sized window, not on a real phone.',
    link: { label: 'Open the Inbox', href: '/office#/inbox' } },
  { id: 'office-questions-before-drafts', added: '2026-10-22', audience: 'site', title: 'The office\'s questions before your saved drafts',
    text: 'On your home screen, when nothing you started could be lost, "Came back from the office" now comes straight under "Flag a defect" and "Request a variation", ahead of "Unfinished reports", so on a phone the office\'s first question is on the first screen even when you have drafts left on several sites. Drafts saved to RELAY are safe, so they now wait under the office\'s questions, and two or more fold into one line ("3 drafts saved to RELAY") that opens to show them. Anything that could still be lost (only on this phone, not saved to RELAY yet, signed but not sent, not sent because there was no signal, or not accepted by RELAY) is still listed in full at the top, above the office\'s questions. Checked in a phone-sized and a desktop browser window, not on a real phone.' },
  { id: 'team-this-week', added: '2026-10-22', audience: 'office', title: 'See who has sent updates this week on the Team tab',
    text: 'On the Team tab, under each person\'s "Last sent", a line now says which days this week they sent a report for and how many sites ("This week: Mon, Tue, today · 3 sites"), or "Nothing sent this week". It counts the day each visit was for, Monday to today, not hours on site. Someone who signed in without being on the list now stays on the Team tab after signing out, as long as they have sent a report in the last two weeks. Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open the Team tab', href: '/office#/team' } },
  { id: 'dates-with-year', added: '2026-10-22', audience: 'all', title: 'Late issues say how late, and old dates say their year',
    text: 'A late issue now says how many days it is past its target ("366 days past target") on the office Issues list, the snag list, the issue page and the Month summary, the same words as the office issue sheet. A date from another year now shows its year on the Weekly and Month summaries, My week, Issues over time, Site coverage and Before handover, so a week from last year, or a target last November, no longer reads as one still to come. Nothing else on those pages has changed. Checked in a desktop browser and a phone-sized window, not on a real phone or printer.' },
  { id: 'handover-days-late', added: '2026-10-22', audience: 'all', title: 'Before handover says how late each snag is',
    text: 'A late snag on Before handover now says how many days it is past its target ("349 days past target"), as an issue does in the office, instead of a date with no year. Before, a snag due last November read "Past target Fri 7 Nov", as if it were not due for two weeks. Target dates and inspection dates from another year now show the year.',
    link: { label: 'Open Before handover', href: '/handover' } },
  { id: 'update-says-its-day', added: '2026-10-22', audience: 'site', title: 'An update says which day it is for',
    text: 'A site update now says under its title which day it is for ("For today, Thu 22 Oct"), and Check & send says the day the office files it under. If you open one left unsent from an earlier day, a note says so: the office files everything in it under that day, so send it as it is and put anything from today in today\'s update. "Go to today\'s update" on the note opens today\'s, or starts it if you have not yet. Nothing in the older update is changed or removed. Checked in a phone-sized browser, light and dark, not on a real phone.' },
  { id: 'photos-phone-in-view', added: '2026-10-22', audience: 'all', title: 'A day\'s photographs on the first screen of a phone',
    text: 'On a phone, choosing a month or a day on Photographs now brings that day\'s photographs up to the top of the screen, with "Newer day" and "Older day" above them, so there is no scrolling down to see them or back up to step to the next day. The same happens when a link opens Photographs on a day, such as a visit\'s "N photographs" on the Weekly summary. The Month and Day choices no longer have a small title above them on a phone (they read "Every month", "Every day" or what you chose), and the line under the heading is left off, so more of the first screen shows photographs. Wider screens look as before. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open Photographs', href: '/photos' } },
  { id: 'not-seen-two-weeks', added: '2026-10-22', audience: 'office', title: 'Not seen yet means the last two weeks',
    text: '"Not seen yet" in the office now counts the reports received in the last two weeks that nobody in the office has opened, so it can come down to nought once you have read what came in. Older reports nobody opened are no longer counted; the Inbox says how many there are and "List them too" shows them. A report that a correction has replaced is not counted either: open the correction. Nothing is marked seen for you, so an engineer still sees "Seen by the office" only when someone opened it. Checked in a desktop browser and a phone-sized window, not on a real phone.',
    link: { label: 'Open the Inbox', href: '/office#/inbox/show/notAck' } },
  { id: 'weekly-summary-phone', added: '2026-10-22', audience: 'office', title: 'The Weekly summary reads on a phone',
    text: 'On a phone, the Weekly summary\'s choices now take three rows instead of five: the project, then Week or Month beside "Print or save as PDF" (now a plain outlined button), then the steps back and forward. So the week\'s figures and the month\'s first two are on the first screen (on phones narrower than most, the week\'s first two). In the Month choice, "Week by week" shows each week as a small block with all six figures named (days on site, reports, issues raised and closed, variations raised and instructed). Before, only days and reports showed and the rest were hidden off the side of the screen. On a desk the print button now sits beside Week and Month. Printing is unchanged. Checked in a phone-sized browser, light and dark, not on a real phone.',
    link: { label: 'Open the Weekly summary', href: '/weekly-summary' } },
  { id: 'shorter-check-and-send', added: '2026-10-22', audience: 'site', title: 'A shorter Check & send',
    text: 'Check & send on a site update now lists only the kinds of card in it, such as "Progress 1", instead of four boxes with three of them 0. Signing a site update is still optional, so the signature box stays folded behind "Add your signature" until you tap it; a draft you have already signed opens with it showing. A one-card update with photos now fits on about one phone screen. Inspections still show the signature box, because they must be signed. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'project-figures-laptop', added: '2026-10-22', audience: 'office', title: 'A project\'s figures on a laptop',
    text: 'On a laptop screen up to about 1400 pixels wide, a project\'s four figures ("Last visit", "Overdue actions", "Fixed, to check" and "Variations") now sit two by two instead of four in a row, so each label fits on one line and the words under each figure take one or two lines instead of up to six. The project\'s details further down, and the four facts at the top of an issue or a variation, sit the same way. Wider screens and phones look as before. Checked in a desktop browser, light and dark, with and without scrollbars showing.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'quiet-card-list', added: '2026-10-22', audience: 'site', title: 'A quieter list of cards',
    text: 'In a site update, a card that is saved now shows a small green dot beside its place instead of a line saying "Saved", so each card in the list is a line shorter and more of them fit on the screen. While a card is being saved it says "Saving" (its photos say "Uploading"), not "Not saved to RELAY yet", so folding a card no longer flashes a warning. A card that really has not gone up, such as one written with no signal, still says so on a line of its own. Checked in a phone-sized browser, light and dark, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'today-from-site-phone-fold', added: '2026-10-22', audience: 'office', title: 'Today from site fits a phone screen',
    text: 'On a phone, "Today from site" on the office overview now shows each project\'s line for the day (its site updates, access problems and what was raised) with its updates folded under it. Tap "Show the 3 site updates" to read them in the engineers\' words. So the whole day fits on one screen, and the reports not seen yet, unassigned issues and fixes to check come straight after it. On a desk nothing changes. Checked in a phone-sized browser window, light and dark, not on a real phone.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'plain-words-engineer', added: '2026-10-22', audience: 'site', title: 'Plainer words on your phone screens',
    text: 'Words on the site screens are shorter and plainer. Where your work is now says "Saved to RELAY", "Saved" or "Only on this phone" instead of talking about a server; a site update no longer says to sign it (signing is optional); in your list on the home screen, an issue nobody is fixing yet says "nobody on it yet"; and "Since your last visit", My week, Notes for the next visit and Flag a defect lose sentences that said the same thing twice. Nothing works differently. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'issues-small-laptop', added: '2026-10-22', audience: 'office', title: 'The Issues list on a small laptop',
    text: 'On a screen 1024 to 1279 pixels wide, such as a small laptop, the office Issues list now starts higher and shows more issues at once. The buttons sit beside the "Issues" heading, the five filters fit on one row, the project\'s name sits under each reference (which already starts with the project\'s code) instead of in a column of its own, "45d late" sits under the target date, and tags such as "Fixed, to check" stay on one line. Each issue reads in two or three lines instead of five or six. On wider screens the tags stay on one line too; otherwise wider screens and phones look as before. Checked in a desktop browser, light and dark.',
    link: { label: 'Open Issues', href: '/office#/issues' } },
  { id: 'month-print-shorter', added: '2026-10-22', audience: 'office', title: 'A shorter printed month',
    text: 'Printing the Weekly summary\'s Month choice, or saving it as a PDF, now gives the ten issues most days past their target, the same ten the screen shows, and then a line saying how many more there are. Each company\'s open and past-target figures still print under "Still open, with whom". On a busy project, a month that came to 28 pages now comes to 7. If you want every late issue on paper, tap "Show all" before you print. Nothing changes on screen. Checked as a PDF saved from a desktop browser, not on a printer.',
    link: { label: 'Open the Weekly summary', href: '/weekly-summary?period=month' } },
  { id: 'today-from-site', added: '2026-10-22', audience: 'office', title: 'Today from site, every project in one place',
    text: 'The office overview now has "Today from site" under "Where each project stands": one block for each project with a site update for today\'s visit, saying how many came in, how many access problems held people up, and the defects and variations raised for the office to answer. Under it is each update in the engineer\'s words, grouped by trade, with any access problems first. Each update opens its report, and each project\'s name opens its sheet. So at the end of the day you can read what every site did without opening each project or each report. "Waiting N days" on a fix to check now counts calendar days, so a fix put forward yesterday evening says "waiting 1 day" this morning, not 0, and matches the date it was put forward. Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'fix-forward-next', added: '2026-10-22', audience: 'site', title: 'Straight on to your next issue after a fix',
    text: 'When you tap "Put forward as fixed" on an issue, the page now says so in a box and offers your next issue on the same site, such as "Next: Spur not labelled", with where it is and how many you have left to do there: the one at the top of your list under Issues, "Yours". Tap it to carry on without going back to the list, or use the Back button under it. The empty form goes away; to add something more for the office, open "Add a note for the office". When it was your last one on that site, it says so. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your issues', href: '/engineer?view=issues' } },
  { id: 'fix-waiting-from-put-forward', added: '2026-10-22', audience: 'office', title: 'How long a fix has waited, counted from when it was put forward',
    text: '"Waiting N days" on a fix to check now counts from when the engineer put it forward as fixed, so a note or photo added afterwards no longer starts the count again. The overview\'s Fixed, to check rows and Attention list the fix that has waited longest first, a project\'s Fixed, to check figure gives the oldest put forward, and "Verify the oldest" starts at the fix that has waited longest rather than the oldest defect. An issue\'s target date now reads "13 Oct" like everywhere else.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'see-fixes-waiting', added: '2026-10-22', audience: 'site', title: 'See which fixes are waiting for the office',
    text: 'On the Issues tab, under each site\'s list, "2 put forward as fixed, waiting for the office to check" now opens to show which ones, and each opens its issue. On your home screen, "Came back from the office" no longer counts a fix you have put forward and the office has not checked yet. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'diary-starts-higher', added: '2026-10-22', audience: 'all', title: 'The site diary starts higher on a phone',
    text: 'On a phone, the Site diary no longer shows a Project list when you open it from a site, since the site\'s name is in the heading, and its explanation is one short line. So the first visit starts on the first screen. A report shows "Rev 2" (or higher) only when it was corrected, and a report sent on its visit day shows only the time it was sent, as the day is in the heading above it. On a wide screen the Project list stays, for switching project. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open the Site diary', href: '/diary' } },
  { id: 'receipt-back-to-site', added: '2026-10-22', audience: 'site', title: 'Back to Site after a defect, and nothing under the Send bar',
    text: 'After you flag a defect, "Defect sent to the office" now has a "Back to Site" button first, then "Open issue" and "View project issues". On a site update or an inspection, the page now always ends clear of the bar with Send to office, even when the bar is taller because it says "Waiting for signal" or offers Undo: scroll to the end and everything above the bar can be read and tapped. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'photos-by-month', added: '2026-10-22', audience: 'all', title: 'Photographs from one month',
    text: 'Photographs now has a Month choice beside Day: pick a month, such as "October 2026", to see that calendar month\'s photographs, newest day first, with how many each month has. "Previous month", "This month" and "Next month" step a month at a time, as on the Weekly summary\'s Month choice, and "Every month" goes back to the full list. With a month chosen, the Day choice lists only that month\'s days. On the Weekly summary\'s Month choice, "Every photograph from October 2026, by day" under "A few photographs" opens it. The month stays in the page\'s link. Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open Photographs', href: '/photos' } },
  { id: 'came-back-every-site', added: '2026-10-22', audience: 'site', title: 'The office\'s questions from your other sites',
    text: '"Came back from the office" on your home screen now also lists what the office wrote on, or sent back, at your other sites, after the site you are on, with the site\'s name at the start of the line. So a question about a fix at one site shows while you are at another, without switching site. Your own new reports and defects from other sites are not listed there. Tap one to open it; the issue shows which site it is on. The list is no longer than before. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'already-raised-here', added: '2026-10-22', audience: 'site', title: 'Defects ask only about issues in the same place',
    text: 'On a defect or access card, "Is this something already raised?" now lists only the open issues at the place you put under Where, or in a part of it (Flat 2 and Flat 2.04 count as the same place; Level 1 and Level 12 do not). When there are none it says so in one line, so "What\'s wrong" sits just under Where. To link an issue somewhere else, tap "Link to an issue somewhere else". On the home screen, the number beside "Came back from the office" now counts only the records the office has done something on, not the reports and defects you have just sent.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'office-smaller-screens', added: '2026-10-22', audience: 'office', title: 'The office on a smaller laptop or a tablet',
    text: 'The office no longer scrolls sideways on a screen narrower than a large monitor. On a small laptop or a tablet on its side, the top bar takes two rows: RELAY and the search box on the first, and Attention, your name, the light or dark setting, Help, Engineer view and Switch company on the second. With a project open, its register and details share the screen and "‹ Projects" at the top of the register goes back to the project list. Below 1024 pixels wide the office lists (Inbox, Issues, Variations, Team) show each row as a card, with an Order choice for sorting issues and variations; below 1366 they pack their columns closer so the Verify and Not finished buttons stay in view. The register heading now shows a project\'s whole name. Checked in a browser from 701 to 1440 pixels wide, light and dark, not on a real tablet.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'tap-after-typing', added: '2026-10-22', audience: 'site', title: 'A tap after typing no longer goes missing',
    text: 'While you type on a card, the bar with Check & send hides to make room. When you then tapped something low on the screen, such as "More for the office", the bar could come back under your finger and the tap did nothing. The bar now waits until your tap is finished. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'check-fixes', added: '2026-10-21', audience: 'office', title: 'Check fixes one after another',
    text: 'In the office, Verify and "Not finished" on a fix waiting to be checked now show the photo of the defect beside the photo sent with the fix, with the engineer\'s note, who put it forward and when, and the target date. Tap a photo to open it full size. After you verify it or send it back, the next fix on the same list opens by itself ("4 of 25"): from the overview, the Issues register in its current order and filters, or "Verify the oldest", longest waiting first. Skip moves on without changing anything, and Stop or Esc closes it. Sending a fix back now needs a reason, so the engineer always sees why it came back. Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open the fixes to check', href: '/office#/issues/show/verify' } },
  { id: 'monthly-summary', added: '2026-10-21', audience: 'all', title: 'A month on one page',
    text: 'The Weekly summary now has a Month choice: one calendar month of one project, for the monthly progress meeting. It gives the month\'s figures (days on site, site reports, issues raised and closed, variations raised and instructed) with a row for each week, cut to the days in the month, so they add up. "Where work moved on" lists each place once with the newest progress written about it. "Behind or stuck" lists issues past their target and places with access problems on more than one day. "Still open, with whom" gives each company\'s open and past-target issues at the end of the month, and "A few photographs" shows the newest progress photograph from up to eight places. Tap a figure to see the records it counts. It prints like the weekly one. Health and safety records are not on it. Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open the Weekly summary', href: '/weekly-summary?period=month' } },
  { id: 'issue-figures-agree', added: '2026-10-21', audience: 'office', title: 'Issue figures that agree',
    text: 'Open, overdue and fixed, to check now mean the same everywhere in the office: the project list, a project\'s figures, "Where each project stands", the Issues register, Issues by company, snag lists, Before handover, the Weekly summary and Issues over time. Open is every issue not yet closed or withdrawn. Overdue is past its target date and not yet put forward as fixed. Fixed, to check is waiting for someone to check it and is never counted as overdue, because the company has done its part. Before, the project list could say "55 overdue" with nothing to check while the figures beside it said 22 were fixed, to check.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'my-week-issues-raised', added: '2026-10-21', audience: 'all', title: 'My week counts every issue you raised',
    text: 'My week used to say "Defects flagged" and counted only defects flagged on their own, so a week of defects sent in site updates read as none. It now says "Issues raised" and counts every defect, access problem or inspection action you raised that week, from a report or flagged on its own, each once: the same count the office sees under "Issues raised" on the Weekly summary. A defect seen again in a later update, or a corrected report, is not counted twice. An issue you put forward as fixed now also says what the office did since: sent it back as not finished, checked it and closed it, or closed it and then opened it again. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open My week', href: '/my-week' } },
  { id: 'team-last-sent', added: '2026-10-21', audience: 'office', title: 'See who has got going on the Team tab',
    text: 'The Team tab now has a "Last sent" column instead of "Now": the site each person last sent a report for and the day of that visit (tap the site to open the report), "Nothing sent yet" for someone who has signed in but sent nothing, and "Not signed in yet" for someone who has never signed in. When a new site starts, or a new engineer joins, you can see at a glance whether they are reporting and from where, without opening each person. Whether someone is signed in now is beside when they signed in (for the Admin, on the person\'s own panel). Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open the Team tab', href: '/office#/team' } },
  { id: 'issues-yours', added: '2026-10-21', audience: 'site', title: 'Your issues on every site, in one list',
    text: 'The Issues tab now opens on "Yours": the open issues you raised or added to, or that are for your trade, on every site you work on, a section per site with how many are still to do. Anything the office sent back comes first, with what they wrote. Once you put one forward as fixed it leaves the list and the site says how many are waiting for the office to check. "Open" and "All issues" still show every trade on a project, and after you open an issue, Back brings you to the same list. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your issues', href: '/engineer?view=issues' } },
  { id: 'office-last-week-summary', added: '2026-10-21', audience: 'office', title: 'Last week\'s summary from the office overview',
    text: 'Each project in "Where each project stands" now has "Last week\'s summary" under its name. It opens that project\'s Weekly summary on last Monday to Sunday, ready for a Monday look back or to print for the client. Pick another project at the top of the summary and it keeps the same week; Back returns to the overview. The summary\'s heading says "last week" beside the dates, so it is not mistaken for this week.',
    link: { label: 'Open the office overview', href: '/office' } },
  { id: 'quicker-inspections', added: '2026-10-21', audience: 'site', title: 'Quicker inspections',
    text: 'On a phone an inspection now opens at the first check still to answer. Tap Satisfactory or Not applicable and the next check opens by itself, with no "Next check" to tap; after the last one you go straight to Check & sign. The check you answered folds to one line that says your answer: tap it to change the answer or add a note or photo. Action needed stays open for you to fill in, and its recent places are now a row of small buttons, with places already used on this inspection first. A 12-check handover inspection with three actions took 33 taps instead of 43. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'office-inbox-phone-reader', added: '2026-10-21', audience: 'office', title: 'Reports open straight away in the Inbox on a phone',
    text: 'On a phone, picking a report in the Inbox now opens it at the top of the screen, instead of under the whole list where it was easy to miss. "‹ Inbox" or the phone\'s Back takes you back to the same place in the list, with the same filters. Inspection names on Inbox rows wrap instead of being cut off. On a computer the list and the report still sit side by side. Checked in a phone-sized browser window, light and dark, not on a real phone.',
    link: { label: 'Open the Inbox', href: '/office#/inbox' } },
  { id: 'office-inbox-tidy', added: '2026-10-21', audience: 'office', title: 'A roomier Inbox, newest first',
    text: 'In the office, the Inbox list now uses the whole width until you open a report, so each row reads across on one line instead of project names wrapping; the reader comes in beside the list when you pick one, and the list then leaves what the visit found to the reader. A report received today says "Today" with the time. "Not seen yet" on the office position now lists the newest first, like the Inbox, so today\'s reports are at the top rather than behind older ones. Checked in a desktop browser, light and dark, and a phone-sized window.',
    link: { label: 'Open the Inbox', href: '/office#/inbox' } },
  { id: 'came-back-first', added: '2026-10-21', audience: 'site', title: 'The office\'s answers first',
    text: '"Came back from the office" now sits under "Flag a defect" and "Request a variation" on the home screen (and under any unfinished reports), above Inspections, so on a phone you usually see it without scrolling. Anything the office wrote on, or sent back to you (an issue marked not finished, a report returned to correct), is at the top of it; your new defects and reports the office has only received come after. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'defect-send-on-signal', added: '2026-10-21', audience: 'site', title: 'A defect sent with no signal goes by itself',
    text: 'Send a defect with no signal and RELAY says "Defect not sent yet" and "Waiting for signal": it is kept on your phone and goes to the office by itself as soon as there is signal, while RELAY is open, the same as a site update. You can carry on with other things in RELAY: it says when the defect has gone, with a link to it. If you closed RELAY, opening it again with signal sends it. "Try again" still sends it straight away, and it only ever goes once. Checked in a phone-sized browser with its signal switched off, not on a real phone.',
    link: { label: 'Open your home screen', href: '/engineer' } },
  { id: 'long-project-names-phone', added: '2026-10-21', audience: 'office', title: 'Whole project names on a phone',
    text: 'On a phone, the heading at the top of a project in the office now shows the whole project name, on a second line if it needs one, under "‹ Projects" and the counts. Before, a long name was cut off, such as "Register · Tetley Ha…".',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'everyone-on-site', added: '2026-10-21', audience: 'office', title: 'Everyone who was on site, at a glance',
    text: 'In the office, "Where each project stands" now names everyone who sent a report from each site on its last visit day, not only the last person to send, such as "Today" over "Sam Spark, Hana Duct and Pat Pipe". One person still shows with their trade; past three names it ends "and N more". A site with no report for three working days still says so there instead; a project\'s Last visit figure always names them. So at the end of the day you can see who was on every site without opening each project. Checked in a desktop browser, light and dark.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'quicker-update-cards', added: '2026-10-21', audience: 'site', title: 'Straight back to typing, and smaller photos',
    text: 'If you leave today\'s site update with an empty card, "Carry on with today’s update" now opens that card ready to type, instead of folded. Photos on a card are now small tiles, two to a row on a phone, with the caption box under each and Remove in the corner of the picture, so a few photos no longer push the next card far down. A green dot on a photo means it is on the server; one that is not there yet still says so in words. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'defect-recent-places', added: '2026-10-21', audience: 'site', title: 'Flag a defect: recent places, one less step',
    text: 'On "Flag a defect", the places used recently on the job now show as small buttons under "Where on site?", the same as on a site update card. Tap one to fill it, or type anything. The button at the bottom now sends the defect straight away and names the site it goes to, such as "Send defect to Tetley Hall - Block E", instead of opening a second screen that repeated what you had written. If there is no signal, RELAY keeps the defect on your phone and says "Defect not sent yet"; tap "Try again" when you have signal and it only goes once. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'first-day', added: '2026-10-21', audience: 'all', title: 'An easier first day',
    text: 'The first time an engineer opens RELAY with more than one site, it asks "Which site are you on?" instead of putting them on the first site in the list, and remembers the answer on that phone. In the office, the Admin\'s Team tab has a welcome message to copy for anyone added who has not signed in yet: the link, putting RELAY on the home screen, signing in and finding their site. RELAY does not send it; send it by text, Teams or email. RELAY\'s home screen icon now opens the company you picked last time, and the sign-in and home screen steps are in plainer words. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'project-on-a-phone', added: '2026-10-21', audience: 'office', title: 'A project at a glance on a phone',
    text: 'On a phone, opening a project in the office now starts with the same four figures as the desk: Last visit, Overdue actions, Fixed, to check and Variations, each opening what it counts. The Weekly summary, Site diary, Photographs and the project\'s other pages come straight after them, then Latest from site and the register. Before, those pages were at the very bottom, under every issue and variation. Checked in a phone-sized browser, not on a real phone.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'office-words-came-back', added: '2026-10-21', audience: 'site', title: 'What the office wrote, where you look',
    text: 'When the office sends back an issue you put forward as fixed, with a question, or writes on a variation you raised, "Came back from the office" on the home screen now shows who wrote, when, and the first line or two of what they said. So does a note the office leaves on a report you sent. Opening the issue shows it at the top, above "Put forward as fixed", instead of folded away in History (a long note shows its first lines, with "Show all of it"); a variation shows it under the office\'s answer. Once you add anything to it, it counts as answered and stays in the history. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'counts-lead-somewhere', added: '2026-10-21', audience: 'office', title: 'Figures that open what they count',
    text: 'On a project sheet, each figure at the top now opens what it counts: Last visit opens that report, Overdue actions and Fixed, to check open the Issues register on that project and filter, and Variations opens the Variations register on that project. In Latest from site, "And N more in the report" opens the report. In the Weekly summary, a visit\'s "N photographs" opens Photographs on that day with that report\'s photographs, and "fixed and waiting to be checked" opens the Issues register on that project. On a phone, the same four figures lead a project\'s register.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'photos-by-day', added: '2026-10-21', audience: 'all', title: 'Photographs from one day',
    text: 'Photographs now has a Day choice: pick a day, such as "Tue 13 Oct 2026", to see only that day\'s photographs, with how many each day has. Photographs from a report are under its visit day; those added to an issue or variation later are under the day they were added. "Newer day" and "Older day" step one day with photographs at a time, and "Every day" goes back to the full list. Choosing another project goes back to every day. The day stays in the page\'s link, so you can send someone straight to it.',
    link: { label: 'Open Photographs', href: '/photos' } },
  { id: 'recent-places-chips', added: '2026-10-21', audience: 'site', title: 'Recent places take less room',
    text: 'On a site update card, the places used recently on the job are now small buttons side by side under "Where", instead of a box of full-width rows with a line of advice under it. The place already in "Where" is not offered again. Tap one to fill "Where", or type anything. On a phone, "What happened" is now on the first screen and "Take a photo" is much nearer the top. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'send-on-signal', added: '2026-10-21', audience: 'site', title: 'Send with no signal, and it goes by itself',
    text: 'Tap "Send to office" with no signal and RELAY now says "Waiting for signal": the report is kept on your phone and goes to the office by itself as soon as there is signal, while RELAY is open, then says it has been sent. If you close RELAY first, the home screen says "Send today\'s update" and opening it with signal sends it. To change something first, go back to the cards or change the signature (it then waits for you to send again), or tap "Don\'t send yet". Checked in a phone-sized browser with its signal switched off, not on a real phone.' },
  { id: 'office-sections', added: '2026-10-21', audience: 'office', title: 'Clearer edges on the office desk',
    text: 'The top bar, the tabs and the column headings now each have their own shade with a clear line between them, so it is easy to see where one ends and the next starts. With a project open, each project in the Projects column is its own card, and the open one has a gold outline.' },
  { id: 'weekly-work-done', added: '2026-10-21', audience: 'all', title: 'The week in the engineers\' words',
    text: 'The Weekly summary now shows what was done on each visit, where and in the engineer\'s own words, so you can read the week without opening every report. The first three updates on a visit show; "Show all" opens the rest. A printed copy has every one.',
    link: { label: 'Open the Weekly summary', href: '/weekly-summary' } },
  { id: 'one-caption-line', added: '2026-10-21', audience: 'all', title: 'A shorter list before sending',
    text: '"Check & send" no longer lists every photograph without a caption on a line of its own. They now share one line at the end, such as "6 photographs have no caption", so the notes that matter to the office (a variation with no photo, nobody named to do an action) are easy to see. Captions are still optional and the caption box is still under each photo. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'simpler-office-screens', added: '2026-10-21', audience: 'office', title: 'One place for each thing in the office',
    text: 'The office position now fills the screen: "Where each project stands" is the project list, so the second list of projects beside it has gone (it comes back once you open a project). The "New reports" group has gone: reports nobody has opened are under "Not seen yet", and the Inbox\'s New filter lists everything new. "Also needs attention" now comes from the same list as the Attention bell, less the unassigned and fixed, to check issues that have their own groups above it. People, names and roles are on the Team tab, so the Admin edits the same list everyone else reads; old links to Admin > People open it.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'office-corrections-names', added: '2026-10-21', audience: 'office', title: 'Quick actions on a sent report, and names',
    text: 'Opening a sent report in the office gives each card a "Quick actions" button: mark it as falling under our contract (an issue moves to Leodis M&E, a variation is marked within contract and not charged), link it to an issue or variation already raised, or add a note. Each change is listed under the card, and the report and its PDF stay as the engineer sent them. The Admin can set the name RELAY shows for each person, and add or take people off the checklist, on the Team tab; access still comes from Microsoft.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'office-add-variation', added: '2026-10-21', audience: 'office', title: 'Add a variation from the office',
    text: 'A variation the office hears about away from site, from a client email or a meeting, can now be added to the register with "Add variation" on the Variations tab or a project\'s sheet. It takes the project\'s next VO number and waits for a quote, like one raised on site.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'lighter-card', added: '2026-10-21', audience: 'site', title: 'A shorter card',
    text: 'A card in a site update no longer opens with four Kind buttons at the top; the card\'s heading already says whether it is progress, a defect, a variation or access. So "Where", "What happened" and "Take a photo" sit about 160px higher on a phone. Picked the wrong kind? Tap "Change kind", next to "Remove" on the card. Tapping "+ Defect" or another kind while the last card is still empty turns that card into the new kind instead of leaving an empty one behind. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'came-back-to-update', added: '2026-10-21', audience: 'site', title: 'Straight to the update',
    text: 'Tapping one of your issues under "Came back from the office" now opens it with "Add photograph" and "Put forward as fixed" on screen for most issues, while what is wrong and where stay in view; a very long description still needs a short scroll to the button. A long description now takes less room, so the buttons sit nearer the top. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'simpler-issue-list', added: '2026-10-21', audience: 'site', title: 'A shorter issues list',
    text: 'Each issue on the Issues tab now shows what is wrong, where, its status and who is fixing it by when, with a small photo beside it, so a phone screen holds several at once. The trade and who reported it are still on the issue itself, under "History". Checked in a phone-sized browser, not on a real phone.' },
  { id: 'sent-report-two-steps', added: '2026-10-21', audience: 'site', title: 'A sent report, at a glance',
    text: 'A report you have sent now shows that RELAY received it and whether the office has seen it (and its review, where the project has one). The PDF and delivery steps, which matter more to the office, are folded under "PDF and delivery"; tap it to see them. If either one goes wrong it shows straight away. The office still sees every step. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'simpler-issue-page', added: '2026-10-21', audience: 'site', title: 'A simpler issue page',
    text: 'Opening an issue now shows what is wrong, where, what needs doing and who is fixing it by when, with "Add photograph" and "Put forward as fixed" straight underneath, near the top of the page. The history and the office\'s detail are folded under "History": tap it to see every update. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'office-simpler-day', added: '2026-10-21', audience: 'office', title: 'A simpler office',
    text: 'Report lists in the office no longer say "PM not notified" on every row: there is no delivery tag unless there is a problem with it, and each report still shows every step when you open it. A project\'s sheet no longer repeats the Needs action list and the reports that sit in the column beside it. The Team tab is in plain words (who can sign in, their role and whether they are signed in now), the top bar\'s "Companies" is now "Switch company", and Admin no longer shows a "Planned" button that did nothing.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'engineer-day-plainer', added: '2026-10-21', audience: 'site', title: 'Plainer words on site',
    text: 'The big button on the Site page is always today’s update now: a site update left from an earlier day waits under "Unfinished reports" instead of being reopened as today’s, and a report the big buttons already open is not listed twice. Your sent reports no longer carry "PM not notified" on every row; the report itself says plainly that RELAY does not email anyone yet, so tell the project manager yourself if something cannot wait. A card you have just added no longer shows a red warning before you have typed anything, and signing a site update is marked optional. On an issue, "Submit as complete" is now "Put forward as fixed", the same words as everywhere else. Checked in a phone-sized browser, not on a real phone.' },
  { id: 'seen-by-office', added: '2026-10-21', audience: 'all', title: 'Seen by the office',
    text: 'When someone in the office opens a report you sent, it now says "Seen by the office" on your report, so you know it landed. Nobody in the office has to press anything: opening it is enough, and the "Acknowledge" button has gone. In the office, "Where each project stands" says how many of each project\'s reports nobody has opened yet, and "Not seen yet" lists them.' },
  { id: 'fewer-taps-site-update', added: '2026-10-21', audience: 'site', title: 'Fewer taps for a site update',
    text: 'A new site update now opens on its first card, a progress card, ready for where, what happened and a photograph; tap Defect, Variation or Access on the card to change it. Under the cards there is a button for each kind ("+ Defect", "+ Variation" and so on), so a new card is one tap instead of two. Places already used on today\'s update are the first ones offered under "Where". The questions the office can do without, such as who should respond to a defect or a variation\'s rough size, are folded under "More for the office", and open by themselves once anything is in them. A card you added and never used is left off when you go to check and send, rather than stopping it. Buttons in the report are bigger, for gloved hands. Sending a site update with a progress card, a defect and a variation took 16 taps on our test phone screen and now takes 14. Tried in a phone-sized browser, not yet on a real phone on site.' },
  { id: 'office-project-progress', added: '2026-10-21', audience: 'office', title: 'Where each project stands',
    text: 'The office position now opens with one list of every project: when someone was last on site and who, how many visits this week and from which trades, open issues and how many are overdue, variations waiting, and how much needs the office. A live site with no report for three working days is marked. Open a project for "Latest from site": each trade\'s newest site update from the last fortnight, line by line in the engineer\'s words, with the defects and variations it raised counted. On a phone the list replaces the second project list that sat under everything else, and a project\'s register starts with its last visit and latest updates. The totals block and latest reports table have gone from the overview; the Inbox lists every report. Nothing new is asked of site: it is all read from the reports engineers already send. Tested in a desktop browser and a phone-sized window, not on a real phone.',
    link: { label: 'Open the office', href: '/office' } },
  { id: 'simpler-for-engineers', added: '2026-10-21', audience: 'all', title: 'A simpler RELAY, built round the site report',
    text: 'The Site page now opens on the job: start or carry on today\'s site update, flag a defect or request a variation, with big buttons at the top. Handover and first fix inspections sit together under them, and the project\'s pages are down to the four used most (issues, reports, notes for the next visit and photographs), with the rest under "More on this project". Toolbox talks, permits to work, deliveries, the weekly safety and tower inspections and Safety actions are now off unless the office turns them on from the Admin tab. While they are off they do not appear on the Site page, the office desk, My week, the weekly summary, Before handover or this Help page, and nothing recorded is deleted.' },
  { id: 'pdfs-hold-long-reports', added: '2026-10-21', audience: 'all', title: 'PDFs that hold a long report',
    text: 'Report and inspection PDFs now hold up when a site fills them. A very long action, owner, place or reason for a correction now carries on to the next page instead of running under the footer and off the paper, where words were lost. In the summary at the front, a very long action or owner is shortened and points to the update that has it in full, so each row stays on one page. A long project name wraps beside the reference instead of printing over itself, and a long place name no longer runs into the label beside it. A panorama gets the full width of the page and a photograph taken top to bottom a taller frame, so neither is a sliver. Small grey labels and dates are a little darker, to read better on paper. PDFs already made stay as they were.' },
  { id: 'site-records-join-up', safetyRecords: true, added: '2026-10-21', audience: 'all', title: 'Talks, permits and deliveries in your week',
    text: 'My week now lists the toolbox talks, permits and deliveries you recorded, closed or sorted, day by day, and the copy for your timesheet counts them. The Weekly summary has a section for the week\'s toolbox talks, permits issued or closed, and deliveries, with any still to sort. On your home screen the Deliveries row is marked while one is still to sort, as Permits to work is for a permit past its end time. In the office, a project\'s register now lists its towers and safety inspections due, open safety actions, permits past their time and deliveries to sort under Needs action, and counts them, so they are seen on a phone too, where the register stands in for the project sheet.',
    link: { label: 'Open My week', href: '/my-week' } },
  { id: 'deliveries-to-site', safetyRecords: true, added: '2026-10-21', audience: 'all', title: 'Deliveries',
    text: 'Record what arrives on site: the supplier, what came, the day, who took it in, where it was put and the delivery note number. Say whether it was all there and in good order; one that came short, damaged or wrong stays under "To sort" until someone on the project says how it was sorted, for example that the rest arrived. The office sees each project\'s deliveries still to sort in Needs attention, so the supplier can be chased while the delivery note is to hand. Your recent suppliers are one tap. RELAY sends nothing to the supplier or anyone else; the spreadsheet download has every delivery.',
    link: { label: 'Open Deliveries', href: '/deliveries' } },
  { id: 'clearer-problems', added: '2026-10-21', audience: 'all', title: 'Clearer messages when something goes wrong',
    text: 'When something goes wrong, RELAY now says what happened, whether your work is safe and what to do, without codes. Signed out partway through a report: it says so, keeps your work on the phone, offers "Sign in again" in a new tab, and saves by itself once you are back. The server not answering or slow: your work stays on the phone and RELAY keeps trying. Photographs of the wrong type or over 20 MB are named and the others still added; a photograph the server will not take names its card. A box over 10,000 characters is pointed out on the card, and nothing is cut off. A spreadsheet or PDF that will not download says so beside the button, and a missing page or a broken one has a plain page with a way home. Work signed on the phone with no signal keeps its signature if the server is down when it goes up.' },
  { id: 'registers-one-set', added: '2026-10-21', audience: 'all', title: 'Spreadsheets that match',
    text: 'The register spreadsheets now read as one set: each starts with its reference (where it has one), project number and project; days are written as dates and times in UK time so Excel can sort them; each event gives its date before who did it; and a withdrawn record keeps its row, saying when, by whom and why. The issue file calls the company that has to respond "Owner", as the register does. Files are named relay, the register, the project number when the file is for one project, and the day. In the office, Variations can now be ordered by any column, as Issues can (on a phone, from the Order list), and the download keeps that order; Issues lists its Project and Trade filters first, as Variations does. Opened in LibreOffice and a spreadsheet library in testing, not yet in Excel itself.' },
  { id: 'permits-to-work', safetyRecords: true, added: '2026-10-21', audience: 'all', title: 'Permits to work',
    text: 'Record each hot works, isolation, roof or confined space permit when it is issued: the work and where, who issued it, who holds it and when it runs until. It stays under "Open now" until someone on the project closes it, ticking the closing check for its kind (for hot works, that the fire watch was kept for at least 60 minutes). A permit still open past its end time is marked red on your home screen and appears in the office\'s Needs attention. "Start from a recent one" fills in yesterday\'s permit again. The closing checks are a first draft, not yet read over by a site manager. RELAY does not issue permits and sends nothing to anyone; the spreadsheet download has every permit for an audit.',
    link: { label: 'Open Permits to work', href: '/permits' } },
  { id: 'first-day-pages', added: '2026-10-21', audience: 'all', title: 'Clearer on your first day',
    text: 'Pages with nothing on them yet now say so plainly and say what fills them. Issues over time no longer draws an empty chart and twelve weeks of noughts, Site coverage no longer calls every site "gone quiet" before any has sent a report, and the office overview says "Nothing has come in from site yet" and "No reports received yet" rather than "Every report has been read"; the Inbox, Issues and Variations say where their records will come from. If you have never opened Help, it now opens with How it works, nothing is marked new, and on site the link to it says "Start here". A draft with nothing on it says so in its preview and PDF.' },
  { id: 'toolbox-talks', safetyRecords: true, added: '2026-10-21', audience: 'all', title: 'Toolbox talks',
    text: 'Record each safety briefing you give on site: the topic, the day, who gave it and the name of everyone who attended. Tap a topic to start from, or "Same people as the last talk" when the same gang is there. The page shows when the last talk was and how many there have been in four weeks, and downloads the whole record as a spreadsheet for an audit. A talk entered by mistake is withdrawn with a reason and stays listed. Toolbox talks are not part of any report and are not sent to anyone. Open it from "This project" on your home screen or from the office project sheet.',
    link: { label: 'Open Toolbox talks', href: '/toolbox-talks' } },
  { id: 'safety-in-needs-attention', safetyRecords: true, added: '2026-10-21', audience: 'all', title: 'Safety in Needs attention',
    text: 'In the office, Attention and the Needs attention lists now include safety: a tower or podium due its inspection, the safety actions still open on a project (one line per project, with how many and the oldest), and a weekly safety inspection that is due. They come straight after a report that could not be processed, ahead of overdue issues, and each opens that project\'s Safety actions. On site, the Safety actions row on the home screen has a red edge while anything is open or due.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'inspection-pdf-found', added: '2026-10-21', audience: 'all', title: 'Inspection PDFs say what was wrong',
    text: 'In an inspection PDF, each row under "Actions arising" now says what was found ("Found: open edge with only a strap across it") above the action, so a client or contractor reading the first page knows what to put right without turning to the notes. Long notes are shortened there and point to the full notes further on. PDFs already made stay as they were.' },
  { id: 'editor-wide-screens', added: '2026-10-21', audience: 'all', title: 'Reports and inspections on a tablet or computer',
    text: 'On a tablet or a computer, the last buttons on a report or inspection are no longer hidden behind the bar at the bottom. The bar lines up with the page, and the check step puts signing beside what is being sent, with a larger box to sign in. A long list of checks scrolls in its own column and keeps the open check in sight. On every screen, a defect linked to an issue already raised takes that issue\'s trade, the check step says how many issues are new and how many add to ones already raised, and while changes are still being saved it says "being saved" rather than "not yet on the server".' },
  { id: 'assign-on-issue', added: '2026-10-21', audience: 'office', title: 'Assign from the issue itself',
    text: 'An issue opened from a search, a report or Issues by company now has "Who puts it right", with Assign or Reassign, a target date and an instruction, so you no longer go back to the desk to give it an owner. The companies already named on the project are suggested as you type. The issue now shows its target date, and its history says who each assignment went to and by when.' },
  { id: 'start-from-safety-actions', safetyRecords: true, added: '2026-10-21', audience: 'site', title: 'Start the inspection that is due from Safety actions',
    text: 'On Safety actions, each project now has "Do a safety inspection", and each tower or podium has "Inspect", gold when it is due. It starts the inspection on that project, with the tower already named as it was last time, so its actions follow it. If you already have a safety inspection in draft on the project, the page carries on with it instead; with a tower inspection in draft, it offers to carry on with that one, and Inspect comes back once it is sent. When you are done, Back brings you to Safety actions. With no signal, start it from the Site page as before.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'day-walkthrough', added: '2026-10-21', audience: 'all', title: 'Smoother from one page to the next',
    text: 'With no signal the site home no longer shows "0 open issues": it says it cannot check with the office, and Notes for the next visit shows the copy kept on your phone. The office\'s "Received this week" keeps this week\'s notifications still to go apart from older ones, and the unfinished "Assigned to me" button has gone from Issues.' },
  { id: 'same-words-reports', added: '2026-10-21', audience: 'all', title: 'The same words in reports and inspections',
    text: 'The report screen and the no-signal page now write dates the way the rest of RELAY does ("Wed 21 Oct, 14:05", no stray commas), count photographs as "photographs", and say "Back to …" naming where Back goes. On the no-signal page an inspection check asks the same questions as in RELAY: "What’s wrong", "What needs doing" and "Who is to do it" for an action, otherwise "Notes". In the PDF, photographs are dated "21 Oct 2026", signatures "21 Oct 2026, 14:05", and the visit date names the day.' },
  { id: 'busy-projects-faster', added: '2026-10-21', audience: 'all', title: 'Quicker on busy projects',
    text: 'On a project with a year or more of reports, the site home, Issues, the snag list and Photographs opened about twice as fast in tests on a slowed-down browser set up like a phone on 4G, and the site home now downloads a few kilobytes instead of every issue on the project. In the office the desk refreshes with a tenth of the data, and downloading the issue register as a spreadsheet takes a moment rather than half a minute. Nothing on the pages has changed.' },
  { id: 'site-notes-offline', added: '2026-10-21', audience: 'site', title: 'Read notes for the next visit with no signal',
    text: 'Notes for the next visit on your projects are now kept on your phone each time you open RELAY with signal, so you can read them in a basement or riser with none. The no-signal page shows them under each project, with when they were last updated. With no signal you can read them but not leave one or mark one done with; do that once you have signal again. Signing out takes them off the phone.' },
  { id: 'same-words', added: '2026-10-21', audience: 'all', title: 'The same words on every page',
    text: 'Pages built at different times now use the same words. An issue put forward as fixed reads "Fixed, to check" everywhere, where it was also "Ready for verification", "Awaiting verification" or "Verify". Dates read one way, such as "Wed 21 Oct", with a time where it matters. Project lists name each project by its number and name, issue and project pages have the same header as the rest of RELAY, and every Back link says where it goes.' },
  { id: 'tidier-pdfs', added: '2026-10-21', audience: 'all', title: 'Tidier report and inspection PDFs',
    text: 'Every page of a PDF now names the report and the project, and on an inspection of one area or item, what was inspected. An inspection opens its results with a count of each result (say 12 checks: 10 satisfactory, 2 action needed), and its table headings carry on to the next page. Each action says who is to do it, the summary uses the same numbers as the updates, a correction says which revision it replaces and why, and a signature says whether it was drawn or typed and when. A card\'s words and its action, and the sign-off, now stay together on one page. PDFs already made stay as they were.' },
  { id: 'tower-inspection', safetyRecords: true, added: '2026-10-20', audience: 'all', title: 'Tower inspection',
    text: 'Inspect a mobile tower or podium after it is put up or moved, and at least every seven days while it stays up. Tap "Do a tower inspection", say which tower (its tag number and where it stands) and answer 12 checks, from its tag to its guardrails and safe working load. Each "Action needed" goes on Safety actions under that tower until a later inspection of the same tower finds it put right, and Safety actions shows when each tower is due its next inspection. It works with no signal like the other inspections. The checks are a first draft and may change.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'site-notes', added: '2026-10-20', audience: 'all', title: 'Notes for the next visit',
    text: 'Leave word on a project for whoever is on site next: where a key is, an area that is locked, what is coming up. Anyone on the project can leave a note or mark one done with, and each shows who left it and when. Notes are not part of any report and are not sent to anyone. Open it from "This project" on your home screen or from the office project sheet.',
    link: { label: 'Open Notes for the next visit', href: '/site-notes' } },
  { id: 'typed-signature', added: '2026-10-20', audience: 'all', title: 'Sign an inspection without drawing',
    text: 'If you can\'t draw a signature, with a keyboard or screen reader say, choose "Type my name instead" when you sign an inspection: type your full name and tick the statement. It works with no signal too. The office and the PDF show it as a typed signature, with the statement, the time it was sent and who was signed in, so it is never mistaken for a drawing. Drawing works as before.' },
  { id: 'company-chases', added: '2026-10-20', audience: 'office', title: 'Chase notes on Issues by company',
    text: 'Each company on Issues by company now has "Log a chase": a line on what was said and, if they gave one, the day they promised to be done by. The card shows who chased last, when and what was promised, and marks "Promise missed" once that day has gone with work still to put right. The notes stay in RELAY for the office and do not change an issue.',
    link: { label: 'Log a chase', href: '/companies' } },
  { id: 'first-fix-inspection', added: '2026-10-20', audience: 'site', title: 'First fix inspection',
    text: 'Walk an area before its ceilings and walls are closed and answer 12 checks on our first fix: run, supported, tested, labelled and clear of the boards. Each "Action needed" goes on the snag list as an issue when you send it, so nothing gets closed in unfinished. It works with no signal like the other inspections. The checks are a first draft and may change. Start it from "Do a first fix inspection" on your home screen.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'home-sheet-tidy', added: '2026-10-20', audience: 'all', title: 'A tidier home screen and project sheet',
    text: 'The pages about a project are now in groups, with the ones used most first. On your home screen My week and Help sit together at the foot. In the office the project sheet keeps them in one box under its figures, and on a phone they now show above the project\'s register, where before they could not be reached.' },
  { id: 'editor-easier-to-read', added: '2026-10-20', audience: 'site', title: 'Report screen easier to read and to tap',
    text: 'On the report screen and the no-signal page, buttons and suggestions are at least a fingertip tall, the gold "Send to office" button stays readable under a mouse, and Access tags are darker. With a keyboard or screen reader, "Next check" and "Check & send" now take you to what opens, each group of choices says what it is for, and the signature box says whether it is signed.' },
  { id: 'issue-trend', added: '2026-10-20', audience: 'all', title: 'Issues over time',
    text: 'See whether a project\'s issue list is getting shorter: for the last 12 weeks, how many issues were raised and closed each week and how many were still open, and past target, at the end of it. Opens from "This project" on your home screen and from the office project sheet.',
    link: { label: 'Open Issues over time', href: '/issue-trend' } },
  { id: 'office-desk-tidy', added: '2026-10-20', audience: 'office', title: 'A tidier office desk',
    text: 'Clicking a variation in the Variations register now opens it, the register fits a laptop screen without scrolling sideways, and the report stages in the Inbox reader no longer run into each other. Inbox, Issues and Variations each have Clear filters, and an empty list says what it means, such as "Every report has been read".' },
  { id: 'offline-sign', added: '2026-10-20', audience: 'site', title: 'Sign an inspection with no signal',
    text: 'With no signal, once every check is answered you can sign an inspection on the phone. It is marked "Signed · not sent yet" and goes to the office by itself the next time RELAY opens with signal, and RELAY tells you when it has gone. If anything changed after you signed, it is not sent: you check it and sign again.' },
  { id: 'before-handover', added: '2026-10-20', audience: 'all', title: 'Before handover',
    text: 'One page per project with everything RELAY still has open: snags on our work by trade, fixes waiting to be checked, handover inspections and their open actions, other trades\' issues, and variations not yet instructed. Ready to print for the handover meeting.',
    link: { label: 'Open Before handover', href: '/handover' } },
  { id: 'easier-to-read', added: '2026-10-20', audience: 'all', title: 'Easier to read and to tap',
    text: 'Grey text is darker in the light theme and lighter in the dark theme, so it is easier to read outdoors or on a dim screen. On a phone, buttons, filters, tabs and Back links are at least a fingertip tall, and screen readers can now find the heading and main part of every office page.' },
  { id: 'editor-tidy', added: '2026-10-20', audience: 'site', title: 'A quicker, calmer report screen',
    text: 'On a phone the card you have open no longer repeats itself above and below, "Check & send" is no longer repeated inside each card (it stays at the foot of the screen), and an inspection just started lists its unanswered checks as one line rather than twelve. Optional suggestions are marked "Optional", so only a "Stop" stops you sending.' },
  { id: 'offline-inspection', added: '2026-10-20', audience: 'site', title: 'Start an inspection with no signal',
    text: 'With no signal, you can now start any inspection as well as a site update, answer its checks and take photographs. It goes up by itself once RELAY opens with signal; you sign it and send it then.' },
  { id: 'help', added: '2026-10-20', audience: 'all', title: 'This Help page',
    text: 'How RELAY works in plain words, what each status means, and this list of what is new. New things are marked until you have looked.' },
  { id: 'handover-inspection', added: '2026-10-20', audience: 'site', title: 'Handover inspection',
    text: 'Walk an area before it is handed over and answer 12 checks on our own M&E work. Each "Action needed" goes on the snag list as an issue when you send it. Start it from "Do a handover inspection" on your home screen.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'offline-start', added: '2026-10-20', audience: 'site', title: 'Start a site update with no signal',
    text: 'With no signal, RELAY opens a page where you can start a site update, add cards and take photos. They stay on the phone, marked "Only on this phone", and go up by themselves once you open RELAY with signal again. Nothing is sent to the office until you send it.' },
  { id: 'safety-actions', safetyRecords: true, added: '2026-10-20', audience: 'all', title: 'Safety actions',
    text: 'Every "Action needed" from the weekly safety inspections, kept open until a later inspection finds it put right, with when each project is due another inspection.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'safety-inspection', safetyRecords: true, added: '2026-10-20', audience: 'site', title: 'Weekly safety inspection',
    text: 'A report of its own with 12 checks, each answered Satisfactory, Action needed or Not applicable, signed and sent like a site update. Start it from "Do a safety inspection" on your home screen.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'my-week', added: '2026-10-20', audience: 'all', title: 'My week',
    text: 'Your own week, day by day, across every project: the reports you sent, defects you flagged and issues you updated. Ready to copy into a timesheet.',
    link: { label: 'Open My week', href: '/my-week' } },
  { id: 'register-downloads', added: '2026-10-20', audience: 'office', title: 'Registers as spreadsheets',
    text: 'The Issues and Variations tabs each have "Download spreadsheet", which saves what the filters show as a CSV file that opens in Excel.',
    link: { label: 'Open the Issues tab', href: '/office#/issues' } },
  { id: 'site-diary', added: '2026-10-20', audience: 'all', title: 'Site diary',
    text: 'Every visit on a project, day by day, built from the reports already sent. Nothing extra to type. Find a word, or show only defects, variations or inspections.',
    link: { label: 'Open the Site diary', href: '/diary' } },
  { id: 'companies', added: '2026-10-20', audience: 'office', title: 'Issues by company',
    text: 'Each company with open issues on any project: how many, how many are past their target, and the oldest. A chase list for the phone call.',
    link: { label: 'Open Issues by company', href: '/companies' } },
  { id: 'corrections-traced', added: '2026-10-20', audience: 'all', title: 'Corrections you can trace',
    text: 'An issue now says which revision of a report changed it. A correction is a new revision and the first stays on file, so nothing is overwritten.' },
  { id: 'suggestions', added: '2026-10-20', audience: 'site', title: 'Companies and locations suggested as you type',
    text: 'The location and "Who needs to respond" boxes suggest what has been written before on the project. You can always type something new.' },
  { id: 'undo', added: '2026-10-20', audience: 'site', title: 'Undo a removed card or photo',
    text: 'Removing a card or photograph from a report shows "Undo" for twelve seconds, so a slip of the thumb costs nothing.' },
  { id: 'another-card', added: '2026-10-20', audience: 'site', title: 'Another card at the same place',
    text: '"Another card here" starts a new card at the location you just wrote, so a walk round one room is quicker.' },
  { id: 'coverage', added: '2026-10-20', audience: 'office', title: 'Site coverage',
    text: 'Which live projects have had a visit and a report lately, and which have gone quiet.',
    link: { label: 'Open Site coverage', href: '/coverage' } },
  { id: 'since-last-visit', added: '2026-10-20', audience: 'site', title: 'Since your last visit',
    text: 'Your home screen lists what changed on the project since you last sent a report there: new issues, fixes and reports from other trades.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'photos', added: '2026-10-20', audience: 'all', title: 'Photographs',
    text: 'Every photograph on a project in one place, grouped by location, with the report or issue it came from.',
    link: { label: 'Open Photographs', href: '/photos' } },
  { id: 'weekly-summary', added: '2026-10-20', audience: 'all', title: 'Weekly summary',
    text: 'One project\'s week on one page, ready to print for the site meeting: visits, what was found, issues opened and closed, variations.',
    link: { label: 'Open the Weekly summary', href: '/weekly-summary' } },
  { id: 'snag-list', added: '2026-10-20', audience: 'all', title: 'Snag lists to print',
    text: 'The open issues for one company or trade on a project, with photographs, ready to print or hand over on a phone.',
    link: { label: 'Open a snag list', href: '/issues/snag-list' } },
  { id: 'stages', added: '2026-10-20', audience: 'all', title: 'Where a sent report has got to',
    text: 'A sent report shows each step on its own line: received, review (only where the project asks for it), PDF, delivery and read. A ready PDF never reads as delivered.' },
  { id: 'unfinished', added: '2026-10-20', audience: 'site', title: 'Unfinished reports on your home screen',
    text: 'Every report you have started and not sent, on any project, stays on your home screen until you send it.' },
  { id: 'search', added: '2026-10-20', audience: 'all', title: 'Search',
    text: 'Search the words in every report, issue and variation open to you, on one project or all of them.',
    link: { label: 'Open Search', href: '/search' } },
];

export interface GuideLink { label: string; href: string; audience: HelpAudience; text: string; safetyRecords?: true }

/** "Where to find things": every page someone might be looking for, by tab. */
export const GUIDE_LINKS: readonly GuideLink[] = [
  { label: 'Your home screen', href: '/engineer', audience: 'site', text: 'Start a site update, flag a defect, request a variation, and see what came back from the office.' },
  { label: 'Office', href: '/office', audience: 'office', text: 'The office position first, then Inbox, Issues, Variations and Team.' },
  { label: 'Search', href: '/search', audience: 'all', text: 'The words in every report, issue and variation.' },
  { label: 'Site diary', href: '/diary', audience: 'all', text: 'Each project day by day, from the reports sent.' },
  { label: 'Photographs', href: '/photos', audience: 'all', text: 'Every photograph on a project, newest first; pick a month or a day, or find a place.' },
  { label: 'Weekly summary', href: '/weekly-summary', audience: 'all', text: 'A project\'s week on one page, for the site meeting.' },
  { label: 'Snag list', href: '/issues/snag-list', audience: 'all', text: 'Open issues for one company or trade, to print.' },
  { label: 'Safety actions', href: '/safety-actions', audience: 'all', safetyRecords: true, text: 'What the safety and tower inspections found, until it is put right, and which towers are due.' },
  { label: 'Before handover', href: '/handover', audience: 'all', text: 'Everything still open on one project, as it nears completion.' },
  { label: 'Issues over time', href: '/issue-trend', audience: 'all', text: 'Whether a project\'s issue list is getting shorter, week by week.' },
  { label: 'Notes for the next visit', href: '/site-notes', audience: 'all', text: 'Word left on a project for whoever is on site next.' },
  { label: 'Toolbox talks', href: '/toolbox-talks', audience: 'all', safetyRecords: true, text: 'Safety briefings given on a project and who attended, ready for an audit.' },
  { label: 'Permits to work', href: '/permits', audience: 'all', safetyRecords: true, text: 'Hot works and isolation permits open on a project, until they are closed.' },
  { label: 'Deliveries', href: '/deliveries', audience: 'all', safetyRecords: true, text: 'Materials taken in on a project, and any short or damaged still to sort.' },
  { label: 'My week', href: '/my-week', audience: 'all', text: 'Your own week across every project.' },
  { label: 'Site coverage', href: '/coverage', audience: 'office', text: 'Which live projects have gone quiet.' },
  { label: 'Issues by company', href: '/companies', audience: 'office', text: 'Who to chase, for what, and what they promised last time.' },
];

/** `safetyRecords`: said after the meaning only while the office has those records on. */
export interface GuideTerm { term: string; meaning: string; safetyRecords?: string }
export interface GuideGroup { heading: string; terms: readonly GuideTerm[] }

/**
 * What the status words mean, in the words the screens use. Kept beside the
 * labels in `status.ts`, `reportTypes.ts` and the office model; a test holds
 * the issue and check words to those sources.
 */
export const GLOSSARY: readonly GuideGroup[] = [
  { heading: 'A sent report', terms: [
    { term: 'Received', meaning: 'On file in RELAY. It cannot be changed now, only corrected.' },
    { term: 'To review', meaning: 'Only on projects set up to need a review; review is off by default. Someone in the office approves it or sends it back with a reason.' },
    { term: 'PDF', meaning: 'RELAY makes the PDF of the report. "Ready" means it is made, not that anyone has it yet.' },
    { term: 'Delivery', meaning: 'Filed in SharePoint for SharePoint projects. RELAY does not email anyone yet, so the step says "Not emailed": if something cannot wait, tell the project manager yourself.' },
    { term: 'Seen', meaning: 'Someone in the office has opened the report. Until then it says "Not seen yet". In the office, "Not seen yet" counts the last two weeks. Nobody has to press anything: opening it is enough.' },
  ] },
  { heading: 'An issue', terms: [
    { term: 'Open', meaning: 'Raised and not yet given to anyone.' },
    { term: 'Assigned', meaning: 'A company or person is down to put it right, usually with a target date.' },
    { term: 'In progress', meaning: 'Work has been recorded on an open issue, or a fix was put forward and sent back.' },
    { term: 'Fixed, to check', meaning: 'Put forward as fixed and waiting to be checked. Someone other than the person who put it forward checks it and verifies it, which closes it.' },
    { term: 'Closed', meaning: 'Checked and found put right.' },
    { term: 'As reported', meaning: 'Stands as the engineer reported it. On a project that uses review it reads "Not reviewed" until the report is reviewed.' },
    { term: 'Confirmed', meaning: 'The office confirmed the observation was right.' },
    { term: 'Disputed', meaning: 'The report it came from was sent back, so the office decides whether it stands.' },
    { term: 'Withdrawn', meaning: 'Raised in error. It stays on the register, marked withdrawn.' },
  ] },
  { heading: 'A variation', terms: [
    { term: 'Awaiting instruction', meaning: 'Raised, and the client has not yet said to do it.' },
    { term: 'Instructed', meaning: 'The client has said to do it; the office records their reference and who gave it.' },
    { term: 'Declined', meaning: 'Not going ahead. It stays on the register.' },
    { term: 'Done, not instructed', meaning: 'Work already carried out on a say-so. The office needs the client\'s written sign-off before it can be charged.' },
  ] },
  { heading: 'An inspection check', terms: [
    { term: 'Satisfactory', meaning: 'Checked and fine.' },
    { term: 'Action needed', meaning: 'Say what is wrong and what needs doing. On a handover or first fix inspection it becomes an issue on the snag list.',
      safetyRecords: 'On a safety inspection it stays on Safety actions until a later inspection finds it Satisfactory or Not applicable; on a tower inspection, until a later inspection of the same tower does.' },
    { term: 'Not applicable', meaning: 'Nothing of this kind to check.' },
  ] },
];

/** Which tab someone lands on: engineers on site, everyone else in the office. */
export function defaultTab(role: string | undefined): HelpTab {
  return role === 'Engineer' ? 'site' : 'office';
}

export function readTab(raw: string | undefined, role: string | undefined): HelpTab {
  return raw === 'site' || raw === 'office' ? raw : defaultTab(role);
}

const forTab = (audience: HelpAudience, tab: HelpTab) => audience === 'all' || audience === tab;

/** Whether something about the safety, permits and deliveries records shows, given the office's switch. */
const switchedOn = (item: { safetyRecords?: unknown }, safetyRecords: boolean) => safetyRecords || !item.safetyRecords;

/** `safetyRecords`: whether the office has those records on (featureSwitch.ts); off, their entries are left out. */
export function whatsNewFor(tab: HelpTab, entries: readonly WhatsNew[] = WHATS_NEW, safetyRecords = true): WhatsNew[] {
  return entries.filter(e => forTab(e.audience, tab) && switchedOn(e, safetyRecords));
}

export function linksFor(tab: HelpTab, links: readonly GuideLink[] = GUIDE_LINKS, safetyRecords = true): GuideLink[] {
  return links.filter(l => forTab(l.audience, tab) && switchedOn(l, safetyRecords));
}

/** A tab's guide with the safety, permits and deliveries parts only while they are on. */
export function guideFor(tab: HelpTab, safetyRecords = true): GuideSection[] {
  return GUIDE[tab].filter(g => switchedOn(g, safetyRecords)).map(g => ({ ...g, steps: [...g.steps, ...(safetyRecords ? g.safetySteps ?? [] : [])] }));
}

/** What a word means, with the part about the safety records only while they are on. */
export const termMeaning = (t: GuideTerm, safetyRecords = true): string => safetyRecords && t.safetyRecords ? `${t.meaning} ${t.safetyRecords}` : t.meaning;

/** Pages only Managers and Admins can open; an engineer reading the office tab is not sent to them. */
const OFFICE_ONLY = ['/office', '/coverage', '/companies'];
export function canOpen(href: string, manager: boolean): boolean {
  if (manager) return true;
  const path = new URL(href, 'https://relay.invalid').pathname;
  return !OFFICE_ONLY.some(p => path === p || path.startsWith(`${p}/`));
}

/** Where each person's "seen" ids are kept on their device. */
export const seenKey = (principalId: string) => `relay-help-seen:${principalId}`;

/** The stored ids, or none if the value is missing or not a list of strings. */
export function readSeen(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * The entries for a tab this person has not seen. Someone who has never
 * opened Help has seen none, so everything for their tab counts as new.
 */
export function unseen(tab: HelpTab, seen: ReadonlySet<string>, entries: readonly WhatsNew[] = WHATS_NEW, safetyRecords = true): WhatsNew[] {
  return whatsNewFor(tab, entries, safetyRecords).filter(e => !seen.has(e.id));
}

/**
 * What to store after a visit: everything seen before plus everything shown
 * now, limited to ids that still exist so the list never grows without end.
 */
export function markSeen(seen: ReadonlySet<string>, shown: readonly WhatsNew[], entries: readonly WhatsNew[] = WHATS_NEW): string[] {
  const known = new Set(entries.map(e => e.id));
  return [...new Set([...seen, ...shown.map(e => e.id)])].filter(id => known.has(id));
}

/** "20 Oct", or "20 Oct 2025" when it is not this year. */
export function addedLabel(added: string, today: string): string {
  const d = new Date(`${added}T12:00:00Z`);
  const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return added.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${added.slice(0, 4)}`;
}

/** `safetyRecords` on a section: shown only while the office has those records on; `safetySteps`: said after the steps only then. */
export interface GuideSection { id: string; heading: string; intro?: string; steps: readonly string[]; ordered: boolean; safetyRecords?: true; safetySteps?: readonly string[] }

/** How the day's work goes, in the order people do it. Button names match the screens. */
export const GUIDE: Record<HelpTab, readonly GuideSection[]> = {
  site: [
    { id: 'first-update', heading: 'Your first site update', ordered: true, steps: [
      'If you work on more than one site, the first time RELAY asks "Which site are you on?": tap yours and it is remembered on your phone. After that, check the current project on your home screen. "Change" picks another.',
      'Tap "Start today’s site update". It opens on a progress card: say where, what happened, and take a photograph. To start with something else, tap "+ Defect", "+ Variation" or "+ Access" under the card and the empty card becomes that; "Change kind", next to "Remove" on the card, changes it once you have started. For the next thing, tap "+ Progress", "+ Defect", "+ Variation" or "+ Access" under the cards; a place you have already used is one tap under "Where".',
      'It saves as you go: "Saved to RELAY" at the bottom means it is safe even if you lose your phone, and your phone keeps a copy too. The office sees it once you send it. Leave it whenever you like; "Carry on with today’s update" opens it again. One left from an earlier day waits under "Unfinished reports", and the big button starts today’s. Open it and a note says which day it is for: the office files everything in it under that day, so send it as it is and put today’s work in today’s update.',
      'When you are done, tap "Check & send", then "Send to office". It is then on file and cannot be changed, only corrected.',
    ] },
    { id: 'after-send', heading: 'After you send', ordered: false, steps: [
      'Defect and Access cards become issues on the project\'s register. Variation cards become variations for the office to price. Each "Action needed" on a handover or first fix inspection becomes an issue too.',
      'Your home screen lists what came back from the office on the things you raised, in the office\'s words, under the main buttons. Anything the office wrote on or sent back is at the top.',
      'The report itself shows each step it has reached: received, PDF, delivery and seen by the office. See "What the words mean" below.',
    ] },
    { id: 'signing', heading: 'Signing an inspection', ordered: false, steps: [
      'An inspection is signed by the person who carried it out. Draw your signature in the box with a finger, pen or mouse.',
      'If you can\'t draw one, choose "Type my name instead", type your full name and tick the statement. It counts as your signature, and the office and the PDF show it as typed, with the time it was sent and who was signed in.',
      'A site update needs no drawing: your name is printed on it either way.',
    ] },
    { id: 'tower', heading: 'A tower or podium', ordered: false, safetyRecords: true, steps: [
      'Inspect each mobile tower or podium after it is put up or moved, and at least every seven days while it stays up. Tap "Do a tower inspection" and say which one: its tag number and where it stands, such as "T3, level 2 east corridor". Use the same name each time, so its actions follow it.',
      'If the name is wrong, tap "Rename" under the title before you send. One tower inspection is open at a time: send it before you start the next.',
      'Safety actions lists each tower inspected in the last four weeks and when it is due again, with "Inspect" to start its next inspection under the same name. If a tower fails, take the insert out of its tag so nobody uses it, and say what needs doing on the check.',
    ] },
    { id: 'defect', heading: 'A defect on its own', ordered: false, steps: [
      '"Flag a defect" sends a photograph and a short note straight away, without a site update. Use it when something needs fixing before you finish the day.',
    ] },
    { id: 'no-signal', heading: 'No signal', ordered: false, steps: [
      'RELAY still opens. You can start a site update or an inspection, add cards or answer checks, and take photographs; they are marked "Only on this phone".',
      'An inspection can be signed on the phone, drawn or by typing your name, once every check is answered. Signing locks it and marks it "Signed · not sent yet". To change anything before RELAY starts sending it, take your signature back and sign again.',
      'Tapped "Send to office" on the report screen with no signal? It says "Waiting for signal" and goes to the office by itself once there is signal, as long as RELAY stays open. If RELAY was closed, open it again: the home screen says "Send today\'s update", and opening it with signal sends it.',
      'Sent a defect with no signal? It says "Defect not sent yet" and goes to the office by itself once there is signal, while RELAY is open (not the "No signal" page), then says it has gone. If RELAY was closed, opening it again with signal sends it.',
      'When you have signal again, open RELAY and the work goes up by itself. A signed inspection goes to the office, and RELAY says when it has gone; if it changed after you signed, it stays a draft for you to sign again. Work from the no-signal page stays a draft until you send it.',
      'Notes for the next visit on your projects show on the no-signal page too, as they were the last time RELAY opened with signal, and say when that was. You can read them there but not leave or mark one until you have signal.',
      'If you share a phone, sign out at the end of the day. Work held on the phone belongs to whoever was last signed in, and signing out takes your notes off it.',
    ] },
    { id: 'next-visit', heading: 'Passing word on', ordered: false, steps: [
      'Under "This project" on your home screen, "Notes for the next visit" shows what the last person left for you: a key, a locked area, what is coming up. Read it before you start.',
      'Leave a note there for whoever comes next. When a note no longer applies, tap "Done with"; it is kept for two weeks in case it is needed back.',
      'Your phone keeps a copy of the open notes each time RELAY opens with signal, so you can still read them in a basement or riser with none. Leaving a note or marking one done with needs signal.',
      'A note is not part of a report and goes to nobody. Anything the client or project manager needs to know still goes in a site update.',
    ] },
    { id: 'wrong', heading: 'Got something wrong', ordered: false, steps: [
      'Before sending: change it. Removing a card or photograph offers "Undo".',
      'After sending: open the report and tap "Make a correction". It goes as a new revision with your reason, and the first stays on file.',
      'If the office sends a report back, it says why. Tap "Make the correction" on the report.',
    ] },
  ],
  office: [
    { id: 'office-day', heading: 'Your day in the office', ordered: true, steps: [
      'Office opens on the office position. "Where each project stands" gives every project\'s last visit and everyone on site that day, its visits this week and by which trades, its open and overdue issues, its variations waiting and how much needs the office; a site with no report for three working days is marked. "Today from site" then reads each project\'s site updates for today\'s visit, with its access problems and the defects and variations raised; on a phone each project\'s updates are folded under its line until you tap to show them. Under it: new reports, reports nobody in the office has opened yet, unassigned issues and issues fixed and waiting to be checked.',
      'Open a project to read "Latest from site": each trade\'s newest site update from the last fortnight, in the engineer\'s own words, with what else it raised.',
      'Opening a report marks it "Seen" with your name and the time, and the engineer sees "Seen by the office" on it. There is nothing to press. Receipt and delivery do not count, and nor does opening a report you wrote yourself.',
      'A report\'s signature line says whether it was drawn or typed. A typed signature shows the statement the person ticked and who was signed in when it was sent.',
      'Give each new issue an owner and a target date, from the desk or with "Assign" on the issue itself. Overdue issues and work done without an instruction are listed under "Also needs attention".',
      'Chase companies with late work from Issues by company, and log each chase there with what they promised, so the next person to ring them knows.',
      'Leave word for the engineers on a project under "Notes for the next visit" on its project sheet, and read what they left each other.',
      'Price variations, then record the client\'s instruction with their reference, or decline. Nothing is deleted.',
    ] },
    { id: 'verify', heading: 'Closing an issue', ordered: false, steps: [
      'Whoever does the work puts it forward as fixed. The issue then reads "Fixed, to check" on every page.',
      'Someone else checks it and verifies it, which closes it, or sends it back as not finished with a reason the engineer will see. RELAY does not let the person who put it forward verify their own work.',
      'Verify shows the photo of the defect beside the photo sent with the fix. When you have decided, the next fix on the same list opens, so you can work through them in one go. Skip leaves one as it is.',
    ] },
    { id: 'review', heading: 'Review', ordered: false, steps: [
      'Review is off unless a project is set up to need it. When it is on, reports wait under "To review" until someone approves them or sends them back with a reason.',
      'Where review is off, issues read "As reported" and stand until someone confirms or withdraws them.',
    ] },
    { id: 'meetings', heading: 'For the site meeting', ordered: false, steps: [
      'Weekly summary puts a project\'s week on one page; its Month choice puts one calendar month on a page for the monthly progress meeting. "Last week\'s summary" under each project on the office overview opens last week\'s straight away. Snag lists print the open issues for one company or trade. Site diary reads back every visit.',
      'Issues by company is the chase list; Site coverage shows which live projects have gone quiet.',
      'A project\'s own pages (Weekly summary, Site diary, Photographs, Notes for the next visit, Issues over time, Before handover) are on its project sheet, under its reports. On a phone they come after the project\'s register.',
    ], safetySteps: [
      'Safety actions, Toolbox talks, Permits to work and Deliveries are on the project sheet too, in their own group, and the weekly summary has a section for the week\'s talks, permits and deliveries.',
    ] },
  ],
};
