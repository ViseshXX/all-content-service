# CLAUDE.md

Design rationale for this file: `docs/superpowers/specs/2026-09-01-context-architecture-design.md`.
It holds **pointers, not copies** — a pointer cannot go stale, a copied value always does.
Never paste a value here that the code already states; point at the file that states it.

---

## 1. What this is

Two applications in one repo, serving the **AXL** (Assisted Language and Math Learning) programme:

| Dir | Stack | Purpose |
|---|---|---|
| `backend/` | NestJS + Fastify + MongoDB (Mongoose), TypeScript, port **3008** | Content REST API + CMS API |
| `frontend/` | React 18 + Vite + TypeScript + Tailwind + Radix | CMS UI for curators |

The CMS is for **teachers and content curators** — separate from the student-facing learner app
(`../all-learner-ai-app`). Fork of `Sunbird-ALL/all-content-service`; `origin` is `ViseshXX/all-content-service`.

Downstream services the backend calls: orchestration (auth/tokens), language-complexity API,
text-evaluation API. See `backend/.env.example` — it is well commented and current.

---

## 2. Running it

```bash
cd backend  && npm run start:dev    # Nest watch mode, :3008. Swagger UI at /api
cd frontend && npm run dev          # Vite
cd backend  && npm run test         # Jest — see the caveat below
cd backend  && npm run context:check # verify docs still match source
```

- `AUTH_BYPASS=true` in `backend/.env` skips all token verification for local dev. Never in production.
- The orchestration dev VM shuts down nightly, so ORC calls may time out — not necessarily a bug.
- **Tests: 6/6 suites, 145 tests, all passing** (repaired 2026-09-02). They had been failing because the
  specs were never updated when constructors and signatures changed. `npm run test` is a usable regression
  signal again. CI runs them on **pull requests only** (`.github/workflows/context-check.yml`), not on
  pushes — so a direct push to a branch does not verify them. And the ~4,300 lines listed in §3 still
  have no specs at all, so green means "the tested parts work", not "the code is safe".
- **`npm run ingest` is broken:** it targets `backend/src/scripts/bulk_ingest.ts`, which does not exist
  (`backend/src/scripts/` contains only `seed-admin.ts`). Do not trust it.

---

## 3. Architecture as it actually is

```
backend/src/
  controllers/   Carry request validation. Route list: docs/generated/api-surface.md
  services/      Business logic + downstream API calls.
  schemas/       Mongoose schemas (content, collection, multilingual, bulk-upload-job, cms-user, audit-log).
  auth/          auth.guard.ts (JWE→JWT→ORC check), roles.guard.ts (admin | curator).
  config/        commonConfig.ts + language/{en,hi,kn,ta,te}.ts — level thresholds.
  scripts/       seed-admin.ts only.
```

There is **no** `modules/`, `dto/`, `repositories/` or `common/` directory, and **no** global exception
filter. That is the actual pattern — follow it. See §4.

**Large files** (reading one costs real context — prefer targeted reads):
`content.service.ts` 2,481 · `bulk-processor.service.ts` 2,026 · `content.controller.ts` 1,879 ·
`bulk-ingest.service.ts` 1,415 · `ContentListPage.tsx` 1,204

**Untested** (~4,300 lines, no spec files — change with extra care):
`bulk-ingest` · `bulk-processor` · `single-content-asset` · `asset-pipeline` · `audit-log` · `cms-user`.
Only `content.service` and `collection.service` have specs.

---

## 4. Override on `.cursor/rules/` — read this before following them

`.cursor/rules/` is **6,039 lines across 18 files**, added by upstream ("Issue #244452 Tekdi cursor AI
rules integration"). Every file is scoped `globs: ["**/*"]`, so it appears to apply everywhere.

**It prescribes a structure this codebase does not use** — `modules/`, `dto/`, `repositories/`,
`common/`, `ApiResponse<T>` response envelopes, a global exception filter, an `I`-prefix interface
convention. None of that is present here.

**Therefore:** on questions of *structure and layout*, follow the existing code (§3), not those rules.
Do not introduce a DTO layer, a repository layer or a response envelope because a rule file asks for it.
On *general engineering practice* the rules are fine guidance.

`.cursor/rules/tekdi-values-as-rules.md` is `alwaysApply: true` and **remains fully in force** — it
expresses values, not layout.

**Do not edit any file in `.cursor/rules/`.** It is upstream-owned.

---

## 5. Navigation map — where facts live

Read the source. Do not trust a value quoted in prose anywhere, including here.
Cited by **symbol**, not line number — symbols move with the code, line numbers rot.

| Need | Canonical source | Must stay in sync with |
|---|---|---|
| Supported languages | `backend/src/services/bulk-ingest.service.ts` → `SUPPORTED_LANGUAGES` | `frontend/src/types/index.ts` → `Language` (in sync — 7 each) |
| Language name → code | same file → `LANGUAGE_NORMALIZE_MAP` | — |
| Template types, tabs, DB target | same file → `TemplateType`, `TEMPLATE_CONFIGS` | `frontend/src/lib/excel-service.ts` |
| Wizard payload | same file → `WizardConfig` | `frontend/src/types/index.ts`, `components/bulk-upload/WizardForm.tsx` |
| Content/Collection/Multilingual shape | `backend/src/schemas/*.schema.ts` | `frontend/src/types/index.ts` |
| Job state machine, resume fields | `backend/src/schemas/bulk-upload-job.schema.ts` | `components/bulk-upload/JobProgress.tsx` |
| Level thresholds L1–L6 | `backend/src/config/commonConfig.ts`, `config/language/*.ts` | — |
| Ingestion limits | `bulk-processor.service.ts` → `MAX_ROWS`, `STORAGE_DIR`, `STALE_CUTOFF_MS`, `RESUME_COOLDOWN_MS` | — |
| Script validation regexes | `bulk-processor.service.ts` → `M1M2_SCRIPT_REGEXES`, applied by `checkIndicScript` | `SUPPORTED_LANGUAGES` — see §6 |
| S3 folder routing | `bulk-processor.service.ts` — rules A–E, documented in-code above the implementation | `docs/decisions/0003-s3-folder-routing.md` |
| Two-pass ingestion | `bulk-processor.service.ts` → `runPass1Validation`, `runPass2Execution` | `docs/decisions/0001-two-pass-validation.md` |
| API surface | the controllers, or Swagger at `/api` (configured in `main.ts` via `DocumentBuilder`) | — |
| Env vars | `backend/.env.example` | — |

---

## 6. Invariants and known hazards

**Full list: `docs/invariants.md`.** It names each rule's source and whether anything enforces it.
Read it before changing ingestion, validation or asset handling. The highlights:

- `audioUrl` in `contentSourceData` follows `{contentId}.wav`.
- M1–M3 (English) embed `multilingual` inline; M4–M9 resolve it via `multilingual_id` lookup, and those
  words must exist in the multilingual collection.
- M10–M15 pass `content_body` as **stringified JSON** inside `mechanics_data`.
- A mechanics entry may legitimately carry only an image or only an audio. Treat optional fields as optional.

Hazards verified in the code — **report, do not silently fix**:

1. **`gu` and `ma` get no script validation.** `SUPPORTED_LANGUAGES` has 7 entries;
   `M1M2_SCRIPT_REGEXES` covers only `kn, te, hi, ta` (English has its own). Deliberate — the doc
   comment on `checkIndicScript` says so — but adding a language grants it zero validation with no signal.
2. **`S3_BUCKET` is defined twice** — in `asset-pipeline.service.ts` and `bulk-processor.service.ts`,
   both `process.env.S3_BUCKET || 'all-dev-content-service'`. The literals can diverge silently.
3. **The "max 2 resumes" limit is frontend-only** (`JobProgress.tsx` → `maxRetriesReached`). The backend
   accepts unlimited resumes when the endpoint is called directly.
4. **`npm run ingest` is broken** (§2), and **`adm-zip` is a declared dependency nothing imports** — the
   very library `docs/decisions/0005-no-adm-zip.md` exists to avoid.
5. **Adding a field to `BulkUploadJob` does not make it reach the UI.** `bulk-upload.controller.ts` lists
   response fields explicitly. This has already caused a bug — `docs/decisions/0002`.

---

## 7. Which docs to trust

This repo has a measured history of confidently-wrong documentation. Current state:

| File | Status |
|---|---|
| `docs/generated/` | **Trust.** Machine-generated from source by `npm run context:generate`. Never edit by hand |
| `docs/decisions/` | **Trust.** Every claim verified against the code 2026-09-02 |
| `docs/invariants.md` | **Trust.** States its sources and whether each rule is enforced |
| `backend/.env.example` | **Trust.** Current and well commented |
| `docs/axl_ekstep_org.md` | **Trust.** Programme background, does not drift |
| `docs/CONTENT_SERVICE_DOCS.md` | **Mixed.** Core concepts and the 12 payload templates are good and not derivable from code. Its **route table, language table and type lists are wrong** — use §5 instead |
| `README.md` | **Ignore.** Still upstream's stock NestJS starter, byte-identical to `upstream/main`. Deliberately not rewritten — see the spec §10.2 |

**Deleted 2026-09-02** (all three stated things that were untrue): `AI_CONTEXT_BULK_UPLOAD.md` — 67% was a
`.cursor/rules` duplicate and its type listings were the origin of the drift; its rationale is now in
`docs/decisions/`. `FRONTEND_BULK_UPLOAD_ARCHITECTURE.md` — described shipped features as "Does not exist".
`docs/context.md` — 0 bytes.

**Before quoting an API route, type or constant, run `cd backend && npm run context:check`.** It
regenerates `docs/generated/` from source, verifies every path and symbol cited in the docs still
exists, and confirms the backend/frontend language lists still agree. Exit 0 means the docs can be
trusted; a non-zero exit tells you exactly what drifted.

**Automation in place.** `.claude/settings.json` regenerates `docs/generated/` whenever a
contract-defining file is edited, and reports at session start whether the docs still match source.
`.github/workflows/context-check.yml` runs the same check on push and pull request. All three layers
exist because the hook only sees edits made through Claude Code — an IDE edit, a branch switch or
someone else's push is caught by the session hook or CI instead.

---

## 8. Working rules

- **Implement strictly what was asked.** No opportunistic refactoring, no adjacent "while I'm here"
  fixes, no extra files, no speculative abstraction. If something else looks wrong, say so and let the
  requester decide.
- **Prioritise accuracy, then efficiency** — in the code that runs, not the code that is quickest to write.
- **Do not assume.** Where a requirement is genuinely ambiguous, ask rather than pick silently.
- **Verify before stating.** Open the file before asserting a fact about the code. Do not skim and
  extrapolate. Cite real paths and real values.
- **Be honest over agreeable.** Say when something is wrong or a bad idea, including when the requester
  proposed it.
- **Never commit, stage or push.** Leave changes in the working tree; the repo owner commits manually.
  Use plain `rm`, not `git rm`, so deletions stay unstaged.
- **Follow `.cursor/rules/`**, except on structure — see §4.
