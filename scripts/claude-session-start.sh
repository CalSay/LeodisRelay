#!/usr/bin/env bash
# SessionStart hook for cloud sessions: run on Node 24 (package.json engines)
# and install dependencies so tests can run in fresh threads.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -lt 24 ]; then
  prefix="$HOME/.relay-node24"
  if [ ! -x "$prefix/node_modules/.bin/node" ]; then
    npm install --prefix "$prefix" --no-audit --no-fund --silent node@24 >/dev/null 2>&1 \
      || echo "Could not install Node 24; continuing on $(node -v)" >&2
  fi
  if [ -x "$prefix/node_modules/.bin/node" ]; then
    export PATH="$prefix/node_modules/.bin:$PATH"
    [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"$prefix/node_modules/.bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

[ -d node_modules ] && exit 0
npm ci --silent --no-audit --no-fund >/dev/null 2>&1 || echo "npm ci failed; run it before testing" >&2
exit 0
