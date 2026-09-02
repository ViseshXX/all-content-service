#!/usr/bin/env bash
# PostToolUse (Write|Edit): regenerate docs/generated/ when a contract-defining file changes.
#
# Contract files are the ones docs/generated/ is derived from. Editing anything else exits
# immediately, so ordinary edits cost nothing.
#
# Change detection hashes the generated files before and after, rather than using git status —
# git reports an untracked directory as changed even when the content is identical.
#
# Never breaks a session: every failure path exits 0.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GEN="$REPO/docs/generated"

command -v jq >/dev/null 2>&1 || exit 0
command -v npm >/dev/null 2>&1 || exit 0
[ -d "$REPO/backend/node_modules" ] || exit 0

FILE="$(jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)"
[ -n "$FILE" ] || exit 0

# Only these paths feed docs/generated/. Keep in sync with CONTRACTS in
# backend/scripts/generate-context.ts.
case "$FILE" in
  *.spec.ts) exit 0 ;;
  */backend/src/services/bulk-ingest.service.ts)    ;;
  */backend/src/services/bulk-processor.service.ts) ;;
  */backend/src/services/asset-pipeline.service.ts) ;;
  */backend/src/schemas/*.ts)                       ;;
  */backend/src/controllers/*.ts)                   ;;
  */backend/src/app.controller.ts)                  ;;
  */frontend/src/types/index.ts)                    ;;
  *) exit 0 ;;
esac

fingerprint() { [ -d "$GEN" ] && cat "$GEN"/*.md 2>/dev/null | md5sum | cut -d' ' -f1 || echo none; }

BEFORE="$(fingerprint)"
OUT="$(cd "$REPO/backend" && npm run --silent context:generate 2>&1)" || {
  jq -n --arg e "$OUT" '{hookSpecificOutput:{hookEventName:"PostToolUse",
    additionalContext:("context:generate FAILED after a contract-file edit, so docs/generated/ may now be stale. Error:\n" + $e)}}'
  exit 0
}
AFTER="$(fingerprint)"

[ "$BEFORE" = "$AFTER" ] && exit 0

jq -n '{hookSpecificOutput:{hookEventName:"PostToolUse",
  additionalContext:"You edited a contract-defining file and docs/generated/ has changed as a result — it was regenerated automatically. Re-read docs/generated/ before quoting any route, type, constant or schema field. If the change also alters a documented decision or business rule, update docs/decisions/ or docs/invariants.md by hand: no script can do that part."}}'
