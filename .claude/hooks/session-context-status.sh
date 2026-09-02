#!/usr/bin/env bash
# SessionStart: report whether docs/generated/ still matches the source.
#
# Covers the drift the PostToolUse hook cannot see — IDE edits, branch switches, someone
# else's push. Answers "can I trust the docs right now?" before anything is quoted from them.
#
# A missing toolchain is NOT stale documentation: if jq, npm or node_modules are absent the
# hook exits silently rather than raising a false alarm.
#
# Never breaks a session: every failure path exits 0.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

command -v jq  >/dev/null 2>&1 || exit 0
command -v npm >/dev/null 2>&1 || exit 0
[ -d "$REPO/backend/node_modules" ] || exit 0
[ -f "$REPO/backend/scripts/generate-context.ts" ] || exit 0

if OUT="$(cd "$REPO/backend" && npm run --silent context:check 2>&1)"; then
  jq -n '{hookSpecificOutput:{hookEventName:"SessionStart",
    additionalContext:"context:check PASSED — docs/generated/, every path and symbol cited in CLAUDE.md and docs/, and the backend/frontend language mirror are all consistent with the source. The generated docs can be quoted as written."}}'
else
  jq -n --arg o "$OUT" '{hookSpecificOutput:{hookEventName:"SessionStart",
    additionalContext:("context:check reported a problem — treat docs/generated/ as STALE and do not quote it until regenerated (cd backend && npm run context:generate). Details:\n" + $o)}}'
fi
