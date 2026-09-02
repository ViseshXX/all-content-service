# 0005 — Streaming ZIP handling, never `adm-zip`

**Where:** `bulk-upload.controller.ts` (multipart streamed to disk — see the OOM comments in the
upload handler); `bulk-processor.service.ts` imports `unzipper` and `extract-zip`

## Decision

Uploaded ZIPs are streamed straight to disk, never buffered in memory. Entry listing uses
`unzipper` (metadata only); extraction uses `extract-zip` to a directory inside the configured
storage path. Only the `.xlsx` is read into memory.

## Why

Bundles carry audio and images for up to `MAX_ROWS` rows and can reach hundreds of megabytes.
Buffering an upload of that size, or using a library that loads the whole archive into RAM,
exhausts the process. The service also runs clustered (`app-cluster.service.ts`), so each worker
pays that cost separately.

## Consequence

**`adm-zip` is still a declared dependency** — it is in `backend/package.json` along with
`@types/adm-zip`, but nothing in `backend/src/` imports it. It is the library this decision
exists to avoid, left installed and one autocomplete away from being used. Removing it is a
code change and has not been done.

Extraction directories must stay inside the configured storage path, not the filesystem root.
Cleanup of stale files is handled on boot via `STALE_CUTOFF_MS`.
