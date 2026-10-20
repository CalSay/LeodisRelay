# RELAY — notes for Claude

Site and compliance reporting platform for Leodis. Read `README.md` for scope
and layout, then the files below before changing anything.

## Start of every task

1. Read `docs/progress.md` (latest entries first) and your task in `docs/tasks.json`.
2. `npm ci` if `node_modules` is missing, then `npm test` to confirm the base is green.
3. Work on one task only. If the task is too big for one PR, split it in
   `docs/progress.md` under "Next" and do the first part.

## Commands

    npm ci                  # Node 24+ (package.json engines)
    npm run typecheck       # all packages + web
    npm test                # builds packages, runs node:test suites (~10 s)
    npm run build           # production web build + worker
    npm --workspace @relay/web run dev   # dev server on :4310

Browser checks (Playwright, Chromium is preinstalled in cloud sessions) run
after `npm test && npm run build`: `node scripts/verify-engineer-layout.mjs`,
`verify-pdf-navigation.mjs`, `verify-role-access.mjs`. Set
`RELAY_BROWSER_PATH` if Playwright cannot find Chromium. Run the relevant one
for any UI change and say which you ran.

## Task list and progress log

- `docs/tasks.json` is the machine-readable work queue built from items Cal
  approved in `docs/product-backlog.md`. You may change only a task's `status`,
  `passes`, `pr` and `notes`. Never add, delete or reword tasks or acceptance
  steps; propose changes in your PR description instead.
- Set `passes: true` only after every acceptance step was checked, with the
  evidence in your final message.
- Before finishing, append a dated entry to `docs/progress.md` in the same PR.

## Rules

- Build only approved scope. Ideas outside `docs/tasks.json` are proposals:
  write them up, don't build them.
- Domain packages depend on platform contracts and their own repositories,
  never another domain's tables. Adapters are wired at the app boundary.
- Keep events distinct: received, reviewed, PM notified, delivered/filed,
  PM acknowledged, issue closed. Review is off by default.
- Docs state what was verified and what was not (no live tenant, no physical
  phone). Never call something production-ready or delivered without proof.
- UK English and plain words in UI copy. Commit subjects are short imperative
  sentences ("Fix SharePoint PDF upload session").
- Never without Cal's go-ahead in the thread: merging, deploying, live
  SharePoint or Entra writes, sending email, changing CI, deleting data.
  SharePoint tests use `DEMO-` records and the allowlisted item only.

## Before calling work done

`npm run typecheck` and `npm test` pass (a Stop hook enforces this when code
changed), the task's acceptance steps are checked, and the `reviewer` subagent
finds no correctness or requirement gaps in the diff.
