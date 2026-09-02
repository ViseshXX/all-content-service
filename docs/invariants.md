# Invariants and coupling hazards

Business rules that no type or schema encodes, plus verified places where the same fact lives in
two files.

**Rules for this file**

- Every entry names its **source** and states honestly whether it is **enforced**.
- Seed only from the repo — the code, or in-repo docs. Do not infer a rule and record it as
  settled; a guessed invariant is a new wrong fact.
- Point at **symbols**, not line numbers.
- Findings are recorded, not fixed. Fixing one is a separate, explicit request.

---

## 1. Cross-template content rules

Source: `docs/CONTENT_SERVICE_DOCS.md` ("Example payloads" preamble and the `mechanics_data`
notes).

| # | Rule | Enforced? |
|---|---|---|
| 1.1 | `audioUrl` inside `contentSourceData` follows `{contentId}.wav` | Not verified — no check found |
| 1.2 | M1–M3 (English) embed `multilingual` inline in the document rather than resolving it from the multilingual collection | Not verified |
| 1.3 | M4–M9: each entry in `multilingual_id` must be a word taken from `text` **and** must exist in the multilingual collection | Partially — `bulk-ingest.service.ts` → `validateMultilingualWords` checks existence in the collection |
| 1.4 | M10–M15 pass `content_body` as **stringified JSON** inside `mechanics_data` | Not verified |
| 1.5 | A mechanics entry may legitimately carry only an image, or only an audio. Optional fields must be treated as optional, not assumed present | By construction — fields are optional in the schema |

## 2. Language and script rules

| # | Rule | Source | Enforced? |
|---|---|---|---|
| 2.1 | Text must match the script of its declared language | `bulk-processor.service.ts` → `M1M2_SCRIPT_REGEXES`, applied via `checkIndicScript` | Yes, for `kn`, `te`, `hi`, `ta`. English uses `M1M2_ENGLISH_REGEX` |
| 2.2 | A language in `SUPPORTED_LANGUAGES` with no entry in `M1M2_SCRIPT_REGEXES` is accepted with **no script validation at all** | The doc comment on `checkIndicScript` states this explicitly: *"Languages without a defined regex are silently accepted."* | By design. Currently affects `gu` and `ma` |

2.2 is deliberate, not a defect. It is recorded because it is a **coupling with no signal**:
adding a language to `SUPPORTED_LANGUAGES` grants it zero script validation, and nothing outside
that one comment says so. Whether `gu` and `ma` *should* be validated is a product question.

## 3. Ingestion limits

| # | Rule | Source | Enforced? |
|---|---|---|---|
| 3.1 | Row limit per upload is `MAX_ROWS` | `bulk-processor.service.ts` | Yes |
| 3.2 | A resume within `RESUME_COOLDOWN_MS` of the job's last update is rejected | same | Yes |
| 3.3 | Maximum 2 resume attempts | `JobProgress.tsx` → `maxRetriesReached` | **Frontend only.** The backend accepts unlimited resumes when the endpoint is called directly. See [decisions/0004](decisions/0004-resume-watermark.md) |

---

## 4. Coupling hazards

Verified duplication — the same fact stated in more than one place, with nothing keeping the
copies in step.

| # | Hazard |
|---|---|
| 4.1 | **`SUPPORTED_LANGUAGES` ↔ frontend `Language`.** `bulk-ingest.service.ts` and `frontend/src/types/index.ts`. *Currently in sync — 7 entries each.* Adding a language means editing both |
| 4.2 | **`S3_BUCKET` is defined twice** — `asset-pipeline.service.ts` and `bulk-processor.service.ts`, both `process.env.S3_BUCKET \|\| 'all-dev-content-service'`. The env var is honoured at both sites, so the literal is only a fallback, but the two literals can diverge |
| 4.3 | **`SUPPORTED_LANGUAGES` ↔ `M1M2_SCRIPT_REGEXES`** — see 2.2 |
| 4.4 | **Schema field ↔ controller response.** `bulk-upload.controller.ts` builds its status response by listing fields explicitly. A new field on `BulkUploadJob` will not reach the UI unless added there too — this has already caused a bug, see [decisions/0002](decisions/0002-mongoose-subdoc-id-false.md) |
| 4.5 | **`npm run ingest` is broken** — `backend/package.json` targets `src/scripts/bulk_ingest.ts`, which does not exist (`src/scripts/` holds only `seed-admin.ts`) |
| 4.6 | **`adm-zip` is a declared dependency nothing imports** — present in `backend/package.json` with its types, imported nowhere in `backend/src/`. It is the library [decisions/0005](decisions/0005-no-adm-zip.md) exists to avoid |
| 4.7 | **`TemplateType` ↔ frontend template generation.** `bulk-ingest.service.ts` and `frontend/src/lib/excel-service.ts` must agree on template names, tabs and columns |
| 4.8 | **Schema class names are inconsistently cased.** The three original schemas declare lowercase classes — `content`, `collection`, `multilingual` — while the three CMS additions use PascalCase: `AuditLog`, `CmsUser`, `BulkUploadJob`. `.cursor/rules/nestjs-1-core-architecture.mdc` prescribes PascalCase, so the originals predate or ignore it. Renaming touches Mongoose model registration and injection tokens, so it is **recorded, not fixed** — but do not "correct" one in passing, and match the surrounding file when adding a schema |
| 4.9 | **Specs are not updated when constructors or signatures change, and nothing catches it.** Four of six suites were broken this way: `contentService` gained a `multilingual` model; controllers gained a leading `@Req()` param and an `AuditLogService` dependency; `content.findById` became `findByIds`; enrichment moved from the controller into the service. Repaired 2026-09-02 — 6/6 suites, 145 tests green, with **no production-code changes** (only `.spec.ts` files). Partly mitigated 2026-09-02: `.github/workflows/context-check.yml` now runs the suite, but **on pull requests only** (`if: github.event_name == 'pull_request'`) — PR-only by choice, because 8+ people push here and a red build on work-in-progress trains people to ignore red builds. **Residual hazard:** a direct push to a branch still runs no tests, and the ~4,300 untested lines are not covered by any of this |

---

## 5. Rules not yet recorded

*Intentionally empty.*

Invariants that are known to the team but not stated anywhere in the repo belong here. Add them
deliberately, with the source of the rule and whether anything enforces it.

Nothing has been inferred into this section on purpose: recording a guess as a settled rule
would reintroduce exactly the problem the documentation rework was done to remove.
