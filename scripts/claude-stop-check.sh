#!/usr/bin/env bash
# Stop hook: block finishing while typecheck or tests fail, but only when code changed.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] || exit 0
base=$(git merge-base HEAD origin/main 2>/dev/null) || exit 0
changed=$( { git diff --name-only "$base"; git ls-files --others --exclude-standard; } \
  | grep -E '\.(ts|tsx|js|mjs|cjs|json)$' | grep -vE '^docs/' )
[ -z "$changed" ] && exit 0
log=$(mktemp)
if ! npm run typecheck >"$log" 2>&1; then
  { echo "Typecheck failed. Fix it before finishing:"; tail -n 40 "$log"; } >&2
  rm -f "$log"; exit 2
fi
if ! npm test >"$log" 2>&1; then
  { echo "Tests failed. Fix them before finishing:"; grep -E '^not ok|Error|# (pass|fail)' "$log" | tail -n 40; } >&2
  rm -f "$log"; exit 2
fi
rm -f "$log"
exit 0
