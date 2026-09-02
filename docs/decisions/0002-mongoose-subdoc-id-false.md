# 0002 — `_id: false` on `failedRowDetails` subdocuments

**Where:** `bulk-upload-job.schema.ts` → the `failedRowDetails` `@Prop`

## Decision

The `failedRowDetails` array subdocument schema declares `_id: false`.

## Why

Without it, Mongoose silently stripped entries from the array during save/update. Rows that
had genuinely failed vanished from the job record, so the UI showed a failure count with no
accompanying errors, and resume had nothing to retry.

The failure mode is the dangerous kind: no exception, no warning, just missing data.

## Consequence

Do not remove `_id: false`, and add it to any new array subdocument on this schema that is
mutated in place. There is no test covering this — `bulk-processor` and the job schema have no
spec files — so the guard is this note plus the comment in the schema.

Related: the same bug had a second half. The controller's `getJobStatus` built its response by
listing fields explicitly and omitted `failedRowDetails` and `resumeCount`, so even correctly
stored errors never reached the UI. Both fields are now returned explicitly. When adding a
schema field that the UI needs, check `bulk-upload.controller.ts` returns it.
