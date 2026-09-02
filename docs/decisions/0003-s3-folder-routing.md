# 0003 — Five ordered S3 folder-routing rules

**Where:** `bulk-processor.service.ts` — the routing block is documented in-code as rules A–E
immediately above the implementation. Read it there; it is the canonical statement.

## Decision

An asset's S3 folder is chosen by five rules evaluated **in order**, first match wins:
images → `mechanics_images`; `dbTarget === 'multilingual'` → `multilingual_audios`; the
`audio_file` / `instruction_audio_file` columns → `all-audio-files/${language}`; a column key
containing both `multilingual` and `audio` → `multilingual_audios`; everything else →
`mechanics_audios`.

TTS-generated main-content audio routes separately — `multilingual_audios` when the target is
the multilingual collection, otherwise `all-audio-files/${language}`.

## Why

The order is the whole decision, and it is not deducible from the folder names.

Rule B is an override: for the Multilingual template *all* audio belongs in
`multilingual_audios` regardless of which column it came from. If it ran after Rule C or D,
multilingual audio would scatter across language folders and the learner app would not find it.

Rule C before Rule D matters because a column can satisfy both: an instruction audio column in
a sheet that also carries multilingual columns. Instruction audio is per-language content, not
translation data.

## Consequence

Inserting a rule in the middle silently re-routes existing uploads, and already-uploaded assets
are not migrated — the learner app resolves paths by convention, so a misrouted file is a
missing file. Append rather than insert, and if order must change, say why here.

There are no tests over this routing.
