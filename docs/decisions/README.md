# Decisions

Why things are the way they are. This directory holds the reasoning that the code cannot
state — intent, ordering rationale, and root causes of bugs already fixed.

**Rules for this directory**

- Record the *why*, never the *what*. If a fact is readable from the source, point at the
  source instead of copying it. Copied values rot; pointers do not.
- Point at **symbols**, not line numbers. Symbols move with the code; line numbers break
  the moment a line is inserted above them.
- If the reasoning behind a decision is not recoverable, say so. Do not invent one.
- One decision per file. Append new ones; do not renumber existing ones.

| # | Decision |
|---|---|
| [0001](0001-two-pass-validation.md) | Validate every row before writing anything |
| [0002](0002-mongoose-subdoc-id-false.md) | `_id: false` on `failedRowDetails` subdocuments |
| [0003](0003-s3-folder-routing.md) | Five ordered S3 folder-routing rules |
| [0004](0004-resume-watermark.md) | Resume via a `processedRows` watermark plus a failed-row set |
| [0005](0005-no-adm-zip.md) | Streaming ZIP handling, never `adm-zip` |
| [0006](0006-auth-in-content-service.md) | Curator auth and audit logs live in this service |
| [0007](0007-tts-error-propagation.md) | TTS failures propagate the real error |

Background on the whole documentation approach:
`docs/superpowers/specs/2026-09-01-context-architecture-design.md`
