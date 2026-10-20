#!/usr/bin/env bash
# SessionStart hook: install dependencies so tests can run in fresh cloud threads.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] && exit 0
npm ci --silent --no-audit --no-fund >/dev/null 2>&1 || echo "npm ci failed; run it before testing" >&2
exit 0
