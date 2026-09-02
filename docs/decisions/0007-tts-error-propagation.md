# 0007 — TTS failures propagate the real error

**Where:** `bulk-processor.service.ts` → `synthesizeAndUploadTTS` and its callers

## Decision

`synthesizeAndUploadTTS` retries up to 3 times, keeps the last error across attempts, and throws
that real error if every attempt fails. It does not return a boolean success flag. Callers catch
it and wrap it with a message naming the language and telling the curator they can supply an
audio file manually instead.

## Why

It previously swallowed the underlying error and returned `false`. Callers could not tell *why*
synthesis had failed, so they reported the only thing they could infer — that the language was
unsupported. Curators uploading valid Kannada and Telugu content were told their language was
not supported, when the real cause was a transient synthesis or conversion failure.

A wrong diagnosis is worse than a raw error: it sends the user to fix something that was never
broken.

## Consequence

The retry loop must not reset the stored error to `null` on a failed attempt, or the original
bug returns.

Note the signature is `Promise<Buffer>` — it returns the generated audio, not `void`. Earlier
documentation stated `Promise<void>`; that was stale.

Callers are responsible for the curator-facing wording. A new call site that lets the raw error
escape will surface an internal message to a curator.

No tests cover this path.
