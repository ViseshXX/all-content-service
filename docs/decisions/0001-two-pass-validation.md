# 0001 — Validate every row before writing anything

**Where:** `bulk-processor.service.ts` → `runPass1Validation`, `runPass2Execution`

## Decision

Bulk ingestion runs in two passes. Pass 1 is read-only: it parses the workbook and validates
every row, accumulating errors rather than throwing on the first one. Only if Pass 1 finds
nothing does Pass 2 write — S3 uploads, TTS generation, MongoDB upserts.

Within a row, validation also accumulates: helpers push into a `rowErrors: string[]` and a
single error is thrown at the end, joined with ` • `.

## Why

Curators upload spreadsheets of up to `MAX_ROWS` rows. Fail-fast produces the worst possible
loop for them — fix one cell, re-upload, wait, discover the next bad cell. Accumulating means
one upload reports every problem at once.

The read-only/write split matters separately: a partial write leaves content in the database
that the curator did not intend and cannot easily find. Validating first means a failed upload
writes nothing at all.

## Consequence

Pass 2 does *not* abort on a row failure — it records the row in `failedRowDetails` and
continues, so one bad row late in a file cannot discard the good rows before it. That is what
makes resume possible; see [0004](0004-resume-watermark.md).

Cost: the workbook is parsed and validated twice.
