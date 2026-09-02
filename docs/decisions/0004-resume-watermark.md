# 0004 — Resume via a `processedRows` watermark plus a failed-row set

**Where:** `bulk-processor.service.ts` → `runPass2Execution`; resume entry point guarded by
`RESUME_COOLDOWN_MS`

## Decision

Pass 2 advances `processedRows` with `Math.max(job.processedRows || 0, i + 1)` — it never moves
backwards. On resume, a row is skipped when it is *both* behind the watermark *and* absent from
the set of previously failed row indexes.

A resume attempt within `RESUME_COOLDOWN_MS` of the job's last update is rejected. Each resume
increments `resumeCount`.

## Why

The watermark alone was not enough. The original skip condition tested only the watermark, so
rows that had *failed* before the watermark were treated as done and never retried — resume
appeared to work while silently skipping the exact rows the user was resuming for.

Hence the two-part condition: the watermark says "we got this far", the failed set says "except
these". A retried row's stale entry is removed from `failedRowDetails` before reprocessing, so
a row that succeeds on retry stops being reported as failed.

`Math.max` guards against a later pass reporting a lower count and rewinding progress.

The cooldown exists because resume is triggered from a UI button and the job runs in the
background: without it, a double-click starts two workers over the same rows.

## Consequence

**The "maximum 2 resumes" limit is frontend-only** — `JobProgress.tsx` computes
`resumeCount >= 2 && job.failedRows > 0` to hide the button. The backend does not enforce it,
so the resume endpoint accepts unlimited attempts when called directly. Treat 2 as a UI
affordance, not an invariant. If it should be a real limit, it needs a backend check.

Skip logic and watermark are untested — `bulk-processor` has no spec file.
