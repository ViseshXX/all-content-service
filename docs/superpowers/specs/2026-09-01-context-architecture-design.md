# Context Architecture — Design Spec

**Date:** 2026-09-01
**Branch:** `content-editor`
**Status:** Implemented 2026-09-02 — all five steps complete and verified. Hooks, CI and the generator
were tested live after a restart: insert / update / delete of a schema field and a route addition each
regenerated `docs/generated/` automatically; a non-contract file correctly triggered nothing.
**Scope:** How project knowledge is stored so that AI-assisted work on the CMS frontend and backend is accurate. No application behaviour changes.

---

## 1. Problem

The repo's documentation states facts about the code that are wrong, while the facts that matter most are not in the repo at all. Both were measured, not assumed.

### 1.1 Documented facts that disagree with the code

| Fact | Actual code | `CONTENT_SERVICE_DOCS.md` | `AI_CONTEXT_BULK_UPLOAD.md` | `FRONTEND_BULK_UPLOAD_ARCHITECTURE.md` |
|---|---|---|---|---|
| `SUPPORTED_LANGUAGES` | `en, hi, ta, te, kn, gu, ma` (7) | 6 (no `ma`) | 6, different order | 8 (`+ ma, or`) |
| `TemplateType` members | **13**, incl. `Textbook image mechanic` | — | 12 | 12 |
| Bulk-upload UI | shipped (`WizardForm.tsx`, 473 lines) | — | described | **"Current state: Does not exist."** |
| Routes described | **50** | 17 | 3 | 6 |

Canonical source for the first two: `backend/src/services/bulk-ingest.service.ts`.
Route count: **50**, per `docs/generated/api-surface.md`. Every hand-count in earlier drafts of this spec said 49 — `app.controller.ts` carries both `@Get()` and `@Get('/ping')`, and the manual grep scanned explicit decorators only inside `controllers/`. Corrected 2026-09-02 once the generator existed; a fitting illustration of R1.

Three documents give three different answers for the language list and none matches the code. A wrong fact is worse than a missing one: a missing fact sends an agent to read the source, a wrong fact stops it looking.

### 1.2 Structural findings

- **`README.md`** (73 lines) is still the stock NestJS starter — "TypeScript starter repository." **Low priority, and corrected 2026-09-02:** an earlier draft called this "the first file most tools open," which was overstated — Claude Code auto-loads `CLAUDE.md`, not `README.md`. It is also **byte-identical to `upstream/main`** (md5 `999ac53f`) and has never been modified on this branch, so a full rewrite would diverge from a file `Sunbird-ALL` owns and conflict on every future upstream pull. See §10.2.
- **Two committed files are 0 bytes:** `docs/context.md` and `.cursor/rules/common-backend.md`. Both are slots that were created and never filled — the intent to store context existed; the follow-through did not.
- **No `CLAUDE.md` and no `.claude/` directory** exist anywhere in the repo.
- **`.cursor/rules/`** is 6,039 lines across 18 files, added by upstream (`28b96a6`, `4d2afec`, `f33e2ac` — "Issue #244452 feat: Tekdi cursor AI rules integration"). Every file is scoped `globs: ["**/*"]`; `tekdi-values-as-rules.md` is `alwaysApply: true`. The rules prescribe `modules/`, `dto/`, `repositories/`, `common/`, an `ApiResponse<T>` envelope and a global exception filter. **The backend has none of these** — its layout is `controllers/`, `services/`, `schemas/`, `auth/`, `config/`, `scripts/`. An agent that obeys these rules works against the codebase.
- **`AI_CONTEXT_BULK_UPLOAD.md` lines 9–1095** (~1,087 lines) restate those same `.cursor/rules` files verbatim, under the header *"Copy this entire file into a new AI chat session."* The same contradictory guidance is paid for twice.
- **Swagger is already configured** — `backend/src/main.ts:8, 27, 70, 71` (`DocumentBuilder`, `SwaggerModule.createDocument`, `setup('api', …)`). A correct, generated API description already exists while a worse hand-written copy is maintained beside it.
- **The newest, most invariant-dense code has no tests:** `bulk-ingest.service.ts` (1,415), `bulk-processor.service.ts` (2,026), `single-content-asset.service.ts` (666), `asset-pipeline.service.ts` (210) — 4,317 lines, zero spec files. Also untested: `audit-log.service.ts` (78), `cms-user.service.ts` (107). Only `content.service.ts` and `collection.service.ts` have specs.
- **Retrieval cost:** `content.service.ts` (2,481), `bulk-processor.service.ts` (2,026), `content.controller.ts` (1,879), `ContentListPage.tsx` (1,204). Editing one route means reading a very large file.
- **Drift is not confined to the docs.** `backend/package.json` declares `"ingest": "npx ts-node -r tsconfig-paths/register src/scripts/bulk_ingest.ts"`, but `backend/src/scripts/` contains only `seed-admin.ts`. The script has pointed at a non-existent file for long enough that nobody noticed — the same failure class as the language list, in a file nobody thinks of as documentation.

### 1.3 The knowledge the repo has no place for

Separately from the wrong facts, there is a category of knowledge the repo currently offers **no home at all**:

- **Why** the two-pass ingestion exists, why `_id: false` is required, why the five S3 routing rules are evaluated in that order, why resume is capped.
- **Business invariants** that no type or schema encodes — which fields are mutually required per template, what makes a mechanics entry valid.
- **Which coupled files must move together** — the backend/frontend mirrors in §4.1.

Some of this is partly recoverable: `AI_CONTEXT_BULK_UPLOAD.md` Part 5 records six real bug root-causes, and `CONTENT_SERVICE_DOCS.md:156, 339–345` states four cross-template rules. But there is no designated file for it, so it accumulates wherever it happens to land — a doc that then drifts, a commit message, or nowhere.

The fix is not to import knowledge from elsewhere. It is to create the files where this class of fact belongs, seed them from what the repo already contains, and leave them structured so they are cheap to extend as decisions get made.

**Boundary:** `~/Desktop/Ekstep/Content Editor/` is the user's private working folder. It is not a source for this design and nothing is copied from it.

### 1.4 Root cause

The storage is **inverted**. Facts the code already states are hand-copied into prose (and rot). Facts the code cannot state are left outside the repo (and are invisible).

---

## 2. First principles

Output accuracy is bounded by what is in the context window at generation time. Context fails in exactly four ways:

1. **Missing** — the fact is nowhere findable.
2. **Wrong** — the fact is written down but stale. Worse than missing, because it suppresses the search that would have found the truth.
3. **Buried** — correct and present, but retrieval costs more than the budget allows, so the model guesses.
4. **Crowding** — correct and findable, but so voluminous it evicts the code being edited.

All four are present today.

Two rules follow:

> **R1. Never hand-write a fact the code already states. Write a pointer to where it is stated.**
> A pointer cannot rot. A copy always does.

> **R2. Hand-write only what the code cannot state** — intent, ordering rationale, business invariants, bug history, roadmap.

And a ranking principle for everything written down:

> **R3. Prefer the form that fails loudest.**
> pointer (cannot drift) → generated (drifts only until re-run) → hook/CI-checked (drift is reported) → test (drift fails the build). Plain prose drifts silently and forever.

---

## 3. Architecture

Five tiers. Each holds only what its form can keep true.

| Tier | Form | Cost | Failure mode | Holds |
|---|---|---|---|---|
| 0 | `CLAUDE.md`, auto-loaded | every request | cannot drift (pointers only) | identity, run commands, real architecture, rules override, navigation map, invariant summary |
| 1 | `docs/generated/*` from `npm run context:generate` | on demand | stale until re-run | API surface, contracts digest |
| 1.5 | Claude Code hooks | on matching edit | reported in-session | regenerate on contract change; report staleness at session start |
| 2 | `docs/decisions/`, `docs/invariants.md` | on demand | silent — needs discipline | why a decision was made, business rules, coupling hazards |
| 3 | Tests *(out of scope — see §9)* | CI | fails the build | the invariants, enforced |

Tier 0 is kept small on purpose: every line is paid on every request, and crowding is a real failure mode. Target ≤ 180 lines.

---

## 4. Tier 0 — `CLAUDE.md`

Repo root. Eight sections:

1. **What this is.** Two applications in one repo: `backend/` (NestJS + Fastify + MongoDB, port 3008) and `frontend/` (React 18 + Vite + TS). A CMS for curators, distinct from the student-facing learner app. Fork of `Sunbird-ALL/all-content-service`.
2. **How to run it** — verified against `backend/package.json` and `frontend/package.json`: `cd backend && npm run start:dev` (Nest watch mode, port 3008); `cd frontend && npm run dev` (Vite). Backend tests: `npm run test`. Also note the two downstream services the backend calls (`ALL_LC_API_URL`, `ALL_ORC_SERVICE_URL`) must be reachable or content creation degrades — see `docs/CONTENT_SERVICE_DOCS.md` for which languages depend on which.
   **Known broken:** `backend/package.json` declares `"ingest": "npx ts-node … src/scripts/bulk_ingest.ts"`, but `backend/src/scripts/` contains only `seed-admin.ts`. The script target does not exist. Record it as broken rather than let the next reader trust it.
3. **Actual architecture.** `backend/src/{controllers,services,schemas,auth,config,scripts}`. No `modules/`, `dto/`, `repositories/`, `common/`. No global exception filter. Controllers carry request validation; services carry business logic and downstream API calls.
4. **Override on `.cursor/rules/`.** State plainly: these 6,039 lines are upstream org-wide boilerplate scoped `globs: ["**/*"]`; they prescribe a structure this codebase does not use; follow existing code patterns for structure. `tekdi-values-as-rules.md` remains fully in force — it expresses values, not layout. **The rule files themselves are not modified.**
5. **Navigation map** (§4.1).
6. **Invariant summary** — the short, expensive-to-break list, linking to `docs/invariants.md`.
7. **Before claiming a code fact** — run `npm run context:check`; if it reports stale, regenerate before quoting `docs/generated/`.
8. **Working rules** (§4.2).

### 4.1 Navigation map

Pointers plus the coupling each one has. The right-hand column does not exist anywhere today and is the most valuable part: it names the mirrors that must move together.

| Need | Canonical source | Must stay in sync with |
|---|---|---|
| Supported languages | `backend/src/services/bulk-ingest.service.ts` → `SUPPORTED_LANGUAGES` | `frontend/src/types/index.ts` → `Language` |
| Language name → code map | same file → `LANGUAGE_NORMALIZE_MAP` | — |
| Template types, expected tabs, DB target | same file → `TemplateType`, `TEMPLATE_CONFIGS` | `frontend/src/lib/excel-service.ts` |
| Wizard payload shape | same file → `WizardConfig` | `frontend/src/types/index.ts`, `components/bulk-upload/WizardForm.tsx` |
| Content / Collection / Multilingual shape | `backend/src/schemas/{content,collection,multilingual}.schema.ts` | `frontend/src/types/index.ts` |
| Job state machine + resume fields | `backend/src/schemas/bulk-upload-job.schema.ts` | `frontend/src/components/bulk-upload/JobProgress.tsx` |
| Level thresholds L1–L6 | `backend/src/config/commonConfig.ts`, `config/language/{en,hi,kn,ta,te}.ts` | — |
| Ingestion limits & constants | `bulk-processor.service.ts:48–52` (`STORAGE_DIR`, `MAX_ROWS`, `STALE_CUTOFF_MS`, `RESUME_COOLDOWN_MS`) | — |
| Per-language script validation | `bulk-processor.service.ts:92` → `M1M2_SCRIPT_REGEXES` | `SUPPORTED_LANGUAGES` — a language added there without a regex here silently skips script validation |
| S3 bucket default | **defined twice**: `asset-pipeline.service.ts:20` and `bulk-processor.service.ts:50`, both `process.env.S3_BUCKET \|\| 'all-dev-content-service'` | the two literals must not diverge |
| API surface | `docs/generated/api-surface.md` *(generated)* | — |
| Auth / audit design rationale | `docs/decisions/0006-auth-in-content-service.md` | — |

### 4.2 Working rules

`CLAUDE.md` loads **in full, unconditionally, every session** — unlike auto-memory, which is recalled by relevance. That makes it the correct home for standing rules that must hold on every turn:

- **Implement strictly what was asked.** No opportunistic refactoring, no adjacent "while I'm here" fixes, no extra files, no speculative abstraction. If something else looks wrong, report it and let the requester decide.
- **Prioritise accuracy, then efficiency** — in the code that runs, not the code that is quickest to write.
- **Do not assume.** Where a requirement is genuinely ambiguous, ask rather than pick silently.
- **Verify before stating.** Check the file before asserting a code fact. This repo has a measured history of confidently-wrong documentation (§1.1) — treat every doc as suspect until checked against source.
- **Follow `.cursor/rules/`**, except on structure, where §4 item 4 applies.

Rationale for putting these in the repo rather than only in personal memory: auto-memory is relevance-recalled and scoped to one project directory, so it is a strong default but not a guarantee. A rule that must hold every turn belongs in the file that always loads. The two are complementary, not redundant.

---

## 5. Tier 2 — hand-written content

### 5.1 `docs/decisions/`

One short file each (~15 lines: context, decision, consequence). Seeded from `AI_CONTEXT_BULK_UPLOAD.md` Part 5 — its six-row bug table is the strongest content in the current docs — plus the code and schema comments that already record intent (for example the `_id: false` note in `bulk-upload-job.schema.ts` and the "silently accepted" comment at `bulk-processor.service.ts:815`).

Where the rationale for a decision is not recoverable from the repo, the file states the decision and marks the reasoning as unrecorded rather than inventing one.

| File | Records |
|---|---|
| `0001-two-pass-validation.md` | Why Pass 1 validates every row and accumulates errors rather than failing fast; why Pass 2 continues past a row failure |
| `0002-mongoose-subdoc-id-false.md` | Why `_id: false` on `failedRowDetails` — without it Mongoose silently strips subdocument entries |
| `0003-s3-folder-routing.md` | The five routing rules and why evaluation order matters |
| `0004-resume-watermark.md` | Why `processedRows` is a `Math.max` watermark, why failed rows are retried despite being behind it, why resume is capped at 2 with a 10s cooldown |
| `0005-no-adm-zip.md` | Why streaming unzip (`unzipper`/`extract-zip`) and stream-to-disk, not `adm-zip` — OOM on large uploads |
| `0006-auth-in-content-service.md` | Curator credentials in `cms_users` rather than the shared orchestration DB; audit logs local rather than in telemetry; `virtualId` vs `username` |

### 5.2 `docs/invariants.md`

Business rules that no type or schema encodes. Each entry records: the rule, the file that should enforce it, and **honestly whether it currently does**.

Seeded **only from in-repo sources** — `docs/CONTENT_SERVICE_DOCS.md` and the code itself:

| # | Rule | Source | Enforced? |
|---|---|---|---|
| 1 | `audioUrl` in `contentSourceData` follows `{contentId}.wav` | `CONTENT_SERVICE_DOCS.md:341` | to confirm |
| 2 | M1–M3 (English) embed `multilingual` inline rather than resolving from the multilingual collection | `:342` | to confirm |
| 3 | M4–M9: every entry in `multilingual_id` must be a word drawn from `text` **and** exist in the multilingual collection | `:343` | partially — `validateMultilingualWords` in `bulk-ingest.service.ts` |
| 4 | M10–M15 pass `content_body` as stringified JSON inside `mechanics_data` | `:344` | to confirm |
| 5 | A mechanics entry may legitimately carry only an image or only an audio; optional fields must be tolerated, not assumed present | `:156` | to confirm |
| 6 | Text must match the script of its declared language | `bulk-processor.service.ts:92` → `M1M2_SCRIPT_REGEXES` | yes, for `kn/te/hi/ta` |
| 7 | A language in `SUPPORTED_LANGUAGES` with no entry in `M1M2_SCRIPT_REGEXES` is **accepted without script validation** — by design, per the comment at `bulk-processor.service.ts:815`. Currently applies to `gu` and `ma` | 7 languages vs 4 regexes (`kn, te, hi, ta`); English uses its own `M1M2_ENGLISH_REGEX` | by design |
| 8 | Row limit per upload is `MAX_ROWS = 1000`; resume is capped at 2 attempts with a 10s cooldown | `bulk-processor.service.ts:49, 52` | yes |

Item 7 is deliberate, not a defect — `checkIndicScript` is explicitly documented as silently accepting unmapped languages. It belongs here because it is a **coupling with no signal**: adding a language to `SUPPORTED_LANGUAGES` silently grants it zero script validation, and nothing in the repo says so outside that one comment. Whether `gu` and `ma` *should* be validated is a product question for the team, not something this spec decides.

The file ends with an explicitly empty **"Rules not yet recorded"** section. Invariants known to the team but not present in the repo belong there, added deliberately by whoever knows them. Nothing is inferred into it — an invariant recorded as settled when it is actually still open would be a new wrong fact, which is the exact failure this spec exists to remove.

### 5.2.1 Known coupling hazards

A short second section of `docs/invariants.md`, for verified duplication that has no single source:

- `S3_BUCKET = 'all-dev-content-service'` is defined in **two** files (`asset-pipeline.service.ts:20`, `bulk-processor.service.ts:50`). Both read `process.env.S3_BUCKET` first, so the literal is only a fallback — but the two literals can diverge silently.
- `backend/package.json` → `"ingest"` points at `src/scripts/bulk_ingest.ts`, which does not exist.
- **`adm-zip` is a declared dependency that nothing imports.** `backend/package.json:39` (plus `@types/adm-zip` at `:68`), with no import anywhere in `backend/src/`. The code correctly uses `unzipper` and `extract-zip` for memory-safe extraction — see the OOM comments at `bulk-upload.controller.ts:133, 138`. Leaving the OOM-prone library installed invites someone to reach for it. Recorded, not removed.
- The backend/frontend mirrors listed in §4.1.

### 5.3 No roadmap file

An earlier draft of this spec proposed `docs/roadmap.md`. **Dropped.** Forward planning is the user's own, kept outside the repo by their choice, and this design has no business mirroring it. The verified code findings that would have landed there (duplicated `S3_BUCKET`, the broken `ingest` script) are recorded in §5.2.1 instead, where they belong — they are facts about the code, not plans.

If a roadmap in the repo is wanted later, it is a separate request.

---

## 6. Tier 1 — the generator

**`scripts/generate-context.ts`**, run via `npm run context:generate`. Writes two files to `docs/generated/`, each carrying `<!-- GENERATED by npm run context:generate — do not edit -->`.

### 6.1 `docs/generated/api-surface.md`

Every route: method, path, controller, auth requirement. Source: the Swagger document already built in `backend/src/main.ts:70`, obtained by creating the Nest application context without listening. Correct by construction, no new dependency.

*Fallback if booting the app in CI proves awkward:* walk the controllers with the TypeScript compiler API and read the `@Controller` / `@Get` / `@Post` / `@Put` / `@Delete` decorators, including bare-path ones. Less rich (no schemas), zero runtime, always available. Decide at implementation time; prefer Swagger.

### 6.2 `docs/generated/contracts.md`

Extracted from source with the TypeScript compiler API: `SUPPORTED_LANGUAGES`, `LANGUAGE_NORMALIZE_MAP` keys, `TemplateType`, `TEMPLATE_CONFIGS`, `WizardConfig`, the ingestion constants, and the field list of each Mongoose schema.

### 6.3 `npm run context:check`

Regenerates into a temp directory and diffs against the committed output. Exit 0 on match; non-zero with a readable diff on mismatch. This is the single command that answers "can I trust the docs right now?" — used by the hooks (§7) and CI (§8).

---

## 7. Tier 1.5 — hooks

Three hooks, at two scopes:

- **§7.1, §7.2 — project-level**, in `.claude/settings.json` (committed). About *this repo's* generated docs.
- **§7.3 — user-level**, in `~/.claude/settings.json`. About *how work is done*, so it applies everywhere. **Already implemented.**

Every command is wrapped so a failure can never break a session, and the project mechanism lives in `package.json` scripts so CI and humans can run it without hooks at all.

### 7.1 `PostToolUse` on `Write|Edit` — regenerate on contract change

Reads `tool_input.file_path` from the hook's stdin JSON. If the path is a contract-defining file — `bulk-ingest.service.ts`, `backend/src/schemas/*.ts`, `backend/src/controllers/*.ts`, `backend/src/config/**`, `frontend/src/types/index.ts` — runs `npm run context:generate` and returns:

```json
{"hookSpecificOutput":{"hookEventName":"PostToolUse",
 "additionalContext":"docs/generated was regenerated because you edited a contract file. Re-read it before quoting API or type facts."}}
```

Every other path exits immediately, so ordinary edits cost nothing. This is the direct fix for §1.1: the moment `SUPPORTED_LANGUAGES` changes, the generated digest changes in the same turn, with no one needing to remember.

### 7.2 `SessionStart` — report whether the docs are trustworthy

Runs `context:check` quietly and injects `additionalContext`: either `context: PASS` or `context: STALE — docs/generated disagrees with source; regenerate before trusting it.`

`CLAUDE.md` structurally cannot carry this, because it is a fact about the present moment. It means a session opened months from now begins knowing whether to believe its own documentation.

### 7.3 `PostCompact` — restore working rules after compaction ❌ REMOVED 2026-09-02

**Outcome: built, then removed.** Kept here as a record of why, not as a live design.

The user's decision: the rules are only needed in this repo, and `CLAUDE.md` reloads automatically after every compaction (§7.3.1, Correction 2), so the hook was redundant here and its only remaining value — cross-repo coverage — was not wanted.

Removed: `hooks.PostCompact` from `~/.claude/settings.json`, plus `~/.claude/hooks/reinject-working-rules.sh` and `~/.claude/working-rules.md`. The user's 8 pre-existing hook events were left untouched and verified intact. Leaving the script and rules file behind with nothing consuming them would have created exactly the dead-artifact problem recorded in `docs/invariants.md` §4.5–4.6.

**Content preserved before deletion.** `working-rules.md` held one rule that existed nowhere else — *never commit, stage or push; the user commits manually*. Moved to auto-memory `feedback_working_style` (rule 9) and to `CLAUDE.md` §8 before the file was deleted. The other rules already existed in both places.

**Lesson for the rest of this spec:** the mechanism was designed and built before its premise was checked against the documentation. Two web lookups would have prevented both this and the `autoCompactWindow` error. Verify platform behaviour against docs *before* building on it, not after.

The original rationale follows, retained because §7.3.1 refers to it.

#### Original design (superseded)

**Problem.** `CLAUDE.md` and auto-memory load at turn 1 — the oldest position in context. Summarisation compresses front-to-back, so standing rules are structurally first to be lost. Two distinct decay mechanisms: compaction loss (rules become a lossy paraphrase) and recency decay (turn-1 content pulls less weight than turn-199 content). In a long session both hit the rules hardest.

**Fix.** A `PostCompact` hook re-injects the rules **verbatim at the newest position** — the strongest place for attention rather than the weakest. Fires on both automatic and manual compaction (no matcher set).

**Scope — user-level, not project-level.** Unlike §7.1 and §7.2, this lives in `~/.claude/settings.json` so it applies to every session in every repo. The rule text is generic; repo-specific rules stay in `CLAUDE.md` §4.2.

| File | Role |
|---|---|
| `~/.claude/working-rules.md` | The rules, plain text. Read fresh at injection time — editable with no restart |
| `~/.claude/hooks/reinject-working-rules.sh` | Emits the file as `hookSpecificOutput.additionalContext` via `jq -Rs` (handles all escaping) |
| `~/.claude/settings.json` | `hooks.PostCompact` → the script, `timeout: 10`, `statusMessage: "Restoring working rules"` |

**The hook is additive, not a replacement.** It does not produce or alter the compaction summary — project context, decisions and requested changes are preserved by the summary exactly as they would be otherwise. The hook appends the rules on top. Rules need the special handling only because they are the oldest content and read like boilerplate; the active task is recent and survives unaided.

### 7.3.1 ⚠️ Two corrections, 2026-09-02 — checked against the official docs

**Correction 1 — `autoCompactWindow` should be left unset. It has been reverted.**

Per [Default auto-compact thresholds](https://code.claude.com/docs/en/model-config#default-auto-compact-thresholds): *"If you don't set an auto-compact window, Claude Code compacts when the conversation reaches the model's context limit"* — with exceptions for cloud sessions, 200K-boundary models, and Sonnet 5.

For `opus[1m]` the default is therefore **≈1M, the context limit itself** — already the maximum. Setting `400000` made compaction roughly **2.5× more frequent**, the direct opposite of the intent, and `850000` was still worse than the default. Both were mine, and both were wrong. The key is now deleted, restoring the default.

Reference point for headroom: Sonnet 5 auto-compacts at ~967K of 1M — about 3.3% margin. The 15% margin reasoned out here was far too conservative and was based on assumption, not documentation.

`/autocompact auto` restores the model-tuned window from inside a session; `/autocompact 500k` sets it. Accepted range 100K–1M, capped at the model's context window.

**Correction 2 — the premise for this hook was partly wrong.**

Per [Explore the context window](https://code.claude.com/docs/en/context-window): *"Compaction replaces the conversation with a structured summary. System prompt, CLAUDE.md, memory, and MCP tools reload automatically."*

So `CLAUDE.md` and auto-memory are **not** summarised away — they reload on their own after every compaction. The §7.3 rationale above ("loaded at turn 1, first to be compressed") does not hold for them. Now that `CLAUDE.md` §8 carries the working rules, the hook is **belt-and-braces rather than the essential fix it was presented as**.

**Verdict: keep it.** It is redundant *in this repo* and load-bearing *outside* it.

- `CLAUDE.md` §8 is a file in this git tree, so it covers this repo only. The hook is in `~/.claude/`, so it covers every repo. `all-learner-ai-app` and the orchestration service have no `CLAUDE.md` — there the hook is the only thing carrying the rules across a compaction.
- The docs state memory "reloads automatically" but not whether that means the full files or only the `MEMORY.md` index. Observed at this session's start: only the index arrived. If reload behaves the same, the full rule text is not guaranteed and the hook supplies it.
- Cost is ~373 tokens per compaction, and with `autoCompactWindow` back to the ~1M default, compaction is rare.

What changed is the hook's *status*, not its usefulness: it was presented as the essential fix for long sessions. `CLAUDE.md` is that fix. The hook is cheap cross-repo insurance on top.

Unverified, deliberately not claimed: whether a reloaded `CLAUDE.md` sits at a weaker context position than fresh injection after the summary.

Also worth knowing for Tier 2: path-scoped rules and nested `CLAUDE.md` files *are* summarised away; only up to five recently-modified files are re-read afterwards, and files over 5,000 tokens return as a path reference without content. A rule that must survive compaction belongs in the project-root `CLAUDE.md`, which is where §4.2 put it — that part was right.

**Verified:** pipe-tested with a real stdin payload (exit 0, correct JSON shape, ~373 tokens); `jq -e` schema check passes; the exact configured command runs end-to-end; before/after diff shows two additions only, with all 8 pre-existing hook events byte-identical; silent exit 0 if the rules file or `jq` is missing. **Not verified:** actual firing — `PostCompact` only runs on compaction, which cannot be triggered within a turn.

**What it does not fix.** Only the rules are restored. Compaction still discards other detail — earlier decisions, file contents already read, rationale for a chosen approach. Shorter sessions with `/clear` between distinct tasks remain worthwhile.

### 7.4 Known caveat — project hooks will not fire until reloaded

This repo has no `.claude/` directory today. Claude Code only watches for settings changes in directories that already held a settings file when the session started. **After `.claude/settings.json` is created, the hooks stay inert until `/hooks` is opened once or Claude Code is restarted.** They will be correctly written and appear dead. `/hooks` is a user-facing menu and cannot be opened on the user's behalf — this must be surfaced at hand-off, not discovered.

### 7.5 Deferred — agent hook for invariant contradiction

Hooks support an `agent` type on tool events. A tightly scoped one could check each edit against `docs/invariants.md` and flag contradictions — the one check a shell script fundamentally cannot perform, and aimed exactly at the failure this spec addresses. Deferred: it spends a model call per matching edit, is unproven here, and can become noise. Recorded so it is not lost; revisit once §7.1 and §7.2 are demonstrably working.

---

## 8. CI

New file **`.github/workflows/context-check.yml`**, running `npm run context:check` on push and pull request.

The 7 existing workflows (`2.0-dev.yml`, `Dev.yml`, `Prod.yml`, `alldev-server.yaml`, `deploy-dev-content.yml`, `deploy-staging-content.yml`, `dev-new.yaml`) are **not touched**.

Hooks catch drift as it is created; CI catches drift that arrived another way (a merge, an edit made outside Claude Code, a session where hooks were not loaded).

---

## 9. Out of scope

Named explicitly so the boundary is not ambiguous:

- **Tier 3 (tests).** Writing specs for the 4,317 untested lines was considered and deliberately deferred: `bulk-processor` alone needs S3, gTTS, ffmpeg and Mongo sessions mocked. Tests are the strongest tier and should be added per-area as the frontend/backend build touches each service — not as an upfront project that delays the build.
- **Splitting large files.** `content.service.ts` (2,481) and `content.controller.ts` (1,879) would benefit, and both have specs (1,375 and 1,597 lines) making a split verifiable. `ContentListPage.tsx` (1,204) will likely be restructured by the frontend work anyway. The bulk services must **not** be split while untested. Separate decision, separate risk.
- **`.cursor/rules/`** — upstream-owned, overridden in `CLAUDE.md`, never edited.
- **`docs/axl_ekstep_org.md`** — programme background; does not drift; left alone.
- **Application behaviour** — no controller, service, schema or component logic changes. This includes every finding in §5.2 and §5.2.1: the `gu`/`ma` script-validation gap, the duplicated `S3_BUCKET` default, and the broken `ingest` script are **recorded, not fixed**. Each is a code change and needs its own request.
- **`~/Desktop/Ekstep/Content Editor/`** — the user's private folder. Not read from, not cited, not copied into the repo.
- **Forward planning / roadmap** — see §5.3.

---

## 10. File plan

### Create

| Path | Tier |
|---|---|
| `CLAUDE.md` | 0 |
| `docs/generated/api-surface.md` | 1 (generated) |
| `docs/generated/contracts.md` | 1 (generated) |
| `scripts/generate-context.ts` | 1 |
| `.claude/settings.json` | 1.5 |
| `.github/workflows/context-check.yml` | 1.5 |
| `docs/decisions/0001…0006` | 2 |
| `docs/invariants.md` | 2 |

Plus `context:generate` and `context:check` entries in `package.json`.

### Rewrite

| Path | Change |
|---|---|
| `README.md` | **Downgraded 2026-09-02 — optional, do not rewrite.** See §10.2 |
| `docs/CONTENT_SERVICE_DOCS.md` | Keep the core-concepts sections and the 12 payload templates — valuable, not derivable from code. Replace the route table, the language table and the type lists with pointers to `docs/generated/` |

### Migrate, then delete

| Path | Change |
|---|---|
| `docs/AI_CONTEXT_BULK_UPLOAD.md` | Migrate then delete. Approved 2026-09-02 — breakdown in §10.1 |

### 10.1 `AI_CONTEXT_BULK_UPLOAD.md` — what is kept

Measured part boundaries (total 1,636 lines):

| Part | Lines | Size | Action |
|---|---|---|---|
| 1 — `.cursor/rules` duplicate (16 rule files) | 7–1096 | 1,090 (67%) | **Discard.** Redundant, and duplicates the structure guidance that contradicts this codebase (§1.2) |
| 2 — BulkUploadJob schema | 1097–1181 | 85 | Discard the code block; **keep the "Key Schema Notes" table** → `decisions/0002`, `0004` |
| 3 — `WizardConfig`, `TemplateType`, `TEMPLATE_CONFIGS`, `SUPPORTED_LANGUAGES` | 1182–1237 | 56 | **Discard.** This is the origin of the drift in §1.1 — "12 templates / 6 languages". Replaced by `docs/generated/contracts.md` |
| 4 — `ContentPayload` and supporting types | 1238–1347 | 110 | **Discard.** Code copy; replaced by the generator |
| 5 — Key architecture decisions & invariants | 1348–1636 | 289 (18%) | **Keep the rationale, discard the code snippets** — see below |

Part 5 has 11 subsections. Migrating to `docs/decisions/`:

- Two-Pass Processing Architecture + Validation Error Accumulation → `0001-two-pass-validation.md`
- Critical Bug Fixes Applied (6 rows) → split across `0002`, `0004`, and a new `0007-tts-error-propagation.md`
- S3 Folder Routing (5 rules, evaluated in order) → `0003-s3-folder-routing.md`
- Resume Logic (rationale only) → `0004-resume-watermark.md`
- TTS retry/wrap rationale → `0007`

Discarded from Part 5 as code duplication now covered by the generator or `CLAUDE.md` §5–6: M1/M2 Script Regex Constants, Key Constants, API Endpoints, Frontend Components, File Locations.

**Format note.** The file was authored as *"Copy this entire file into a new AI chat session"* — a snapshot. That format is the root failure: a snapshot cannot be maintained, so it rotted. The replacement is many small files that each have a reason to be updated.

### 10.2 `README.md` — do not rewrite

Evidence: `git log -- README.md` shows 3 commits, all from the original upstream history; the file is **byte-identical to `upstream/main`** (md5 `999ac53f`).

A full rewrite would fork a file `Sunbird-ALL` owns, producing a merge conflict on every future upstream pull for no functional gain — `CLAUDE.md` already serves the agent-accuracy goal, and it loads automatically where the README does not.

**Recommended instead:** an additive ~5-line note at the top ("this fork adds a CMS; see `CLAUDE.md`"), leaving upstream's body intact. Minimal diff, minimal conflict surface, and it fixes the misleading first impression for a human arriving on GitHub.

**Acceptable alternative:** do nothing. It has been stock boilerplate for the project's whole life with no observed harm.

Either way this is the lowest-value item in §13 step 1 and must not gate it.

### Delete

| Path | Reason |
|---|---|
| `docs/FRONTEND_BULK_UPLOAD_ARCHITECTURE.md` | Describes shipped features as "Does not exist"; actively misleading |
| `docs/context.md` | Committed at 0 bytes |

`.cursor/rules/common-backend.md` is also 0 bytes but is upstream-owned and therefore left in place (§9).

---

## 11. Verification

The design is only worth anything if it is checkable:

1. `npm run context:generate && npm run context:check` exits 0.
2. Each of the three drifted facts in §1.1 resolves to exactly one source, and that source agrees with the code: `SUPPORTED_LANGUAGES` = 7 entries, `TemplateType` = 13 members, routes = 49.
3. `grep -rn` for hand-written route tables and language lists in `docs/` returns nothing outside `docs/generated/`.
4. `CLAUDE.md` is ≤ 180 lines.
5. Editing `SUPPORTED_LANGUAGES` causes hook §7.1 to regenerate `docs/generated/contracts.md` in the same turn (demonstrable after the `/hooks` reload in §7.4).
6. A session given only `CLAUDE.md` answers "how many languages are supported, and where is that defined?" correctly without searching the source.
7. §7.3 — after a compaction, the working rules are present verbatim in context and the compaction summary still carries the project/task context. Observable via the *"Restoring working rules"* status message. ✅ configuration verified 2026-09-01; firing observable only on a real compaction.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Booting Nest to read the Swagger document is slow or fails in CI | TypeScript-compiler fallback in §6.1; decide at implementation time |
| Hooks appear broken because settings were created mid-session | §7.3 — surfaced at hand-off, not left to be discovered |
| An invariant in §5.2 is recorded as settled but is actually still open | Explicit review gate in §5.2 before the file lands |
| Deleting `FRONTEND_BULK_UPLOAD_ARCHITECTURE.md` loses something still useful | It is in git history; its only current-state content (the API client and polling patterns) already exists in code |
| `CLAUDE.md` grows over time and starts crowding | Line cap in §11.4; anything longer belongs in `docs/` behind a pointer |
| Generated files produce noisy diffs | Stable ordering in the generator; `do not edit` headers |

---

## 13. Sequencing

**Step 0 — done 2026-09-01.** §7.3, the user-level `PostCompact` rules-restoration hook and `autoCompactWindow`. Independent of everything else: it lives outside the repo and needed no approval of the wider design.

1. ✅ **DONE 2026-09-02.** `CLAUDE.md` (173 lines, approved); `docs/decisions/0001–0007` + index; `docs/invariants.md` with §5 left empty per the user's decision; deleted `AI_CONTEXT_BULK_UPLOAD.md`, `FRONTEND_BULK_UPLOAD_ARCHITECTURE.md`, `docs/context.md`. All line-number citations replaced with symbol references (§14.5). Nothing staged or committed — the user commits manually. `README.md` deliberately untouched per §10.2.

   **Corrections found while migrating** — the migrated docs were themselves stale, which is the point:
   - `synthesizeAndUploadTTS` returns `Promise<Buffer>`, not `Promise<void>` as Part 5 claimed.
   - The "max 2 resumes" limit is **frontend-only** (`JobProgress.tsx` → `maxRetriesReached`). No backend enforcement — the endpoint accepts unlimited resumes. Part 2 presented it as a rule.
   - S3 Rule C covers `audio_file` **or** `instruction_audio_file`; Part 5 listed only the latter.
   - Part 2's schema copy omitted `submittedBy`, `resultCollectionId`, `resultCollectionName`.
   - Auto-memory `project_auth_audit` claimed `virtualId` was generated locally as a random 10-digit number. It is **obtained from orchestration** via `getVirtualIdFromOrchestration`. Memory corrected at source.
2. ✅ **DONE 2026-09-02.** `backend/scripts/generate-context.ts`; `context:generate` / `context:check` in `backend/package.json`; `docs/generated/{api-surface,contracts}.md`; pointer rewrites in `CONTENT_SERVICE_DOCS.md` (1,158 → 1,038 lines, all 13 payload templates kept).

   **Deviation from §6.1 — static parsing, not Swagger.** `app.module.ts` uses `MongooseModule.forRootAsync`, so booting Nest to read `SwaggerModule.createDocument` needs a live MongoDB — useless in CI. The generator parses `@Controller` / `@Get` / `@Post` / `@Put` / `@Delete` / `@Patch` decorators with the TypeScript compiler API instead: no runtime, always works. Cost: no request/response schemas. Swagger at `/api` still provides those when the app runs.

   **`context:check` verifies three things**, per §14.5: generated files match source; every path and `→ Symbol` citation in `CLAUDE.md` and `docs/` resolves; the backend/frontend language lists agree. `docs/superpowers/` is excluded from citation checking — a design spec necessarily references files that are planned, rejected, or outside the repo.

   **Verified by injecting drift:** adding `'or'` to `SUPPORTED_LANGUAGES` made the check exit 1, reporting both the stale `contracts.md` and the out-of-sync mirror. Source restored afterwards.

   **Two findings from the first run:**
   - **Routes are 50, not 49.** Every hand-count in this spec said 49. `app.controller.ts` carries both `@Get()` and `@Get('/ping')`, and the manual grep only scanned explicit decorators inside `controllers/`. `CLAUDE.md` no longer states a number — it points at the generated file.
   - **Schema class names are inconsistently cased** — `content`, `collection`, `multilingual` are lowercase; `AuditLog`, `CmsUser`, `BulkUploadJob` are PascalCase. Recorded in `docs/invariants.md` §4.8, not fixed: renaming touches Mongoose model registration.
3. ✅ **DONE 2026-09-02.** `.claude/settings.json` (committed, per §14.1) wiring two hook scripts, plus `.github/workflows/context-check.yml`. The two `EXPECTED_MISSING` entries in the generator were removed, so those paths are now enforced.

   | File | Role |
   |---|---|
   | `.claude/hooks/on-contract-change.sh` | `PostToolUse` on `Write\|Edit` — regenerates `docs/generated/` when a contract-defining file changes |
   | `.claude/hooks/session-context-status.sh` | `SessionStart` — reports whether the docs still match source |
   | `.github/workflows/context-check.yml` | `npm run context:check` on push and PR. The 7 deployment workflows were not touched |

   **Two bugs found by testing, both fixed:**
   - Change detection used `git status --porcelain -- docs/generated`, which reports an *untracked* directory as changed even when content is identical — so the hook fired on every contract edit. Now hashes the generated files before and after.
   - A missing `npm` made the `SessionStart` hook announce "documentation is STALE". A missing toolchain is not stale documentation. Both hooks now exit silently when `jq`, `npm` or `node_modules` are absent.

   **Verified end-to-end:** adding a `@Prop()` field to `cms-user.schema.ts` made the hook fire *and* the field appeared in `contracts.md`. Non-contract files, `.spec.ts` files and unchanged content all exit silently. Source restored; `context:check` passes.

   **Unverifiable until reload:** the hook `command` values are repo-relative (`.claude/hooks/…`), which is correct for a committed file — an absolute path would break for anyone else — but assumes the hook runs with the project root as its working directory. The scripts resolve the repo from their own location, so only *finding* them depends on cwd. Confirm after the `/hooks` reload below.

**Step 4 — test-suite repair, done 2026-09-02** (requested after step 3; not part of the original design).

6/6 suites and 145/145 tests now pass, up from 2/6 and 19/73. **No production code was changed** — only four `.spec.ts` files. `tsc --noEmit` clean; the suite was run twice to rule out order-dependence.

Every failure was the same class: production code moved and the spec did not follow.

| Spec | What had changed |
|---|---|
| `content.service.spec.ts` | `contentService` gained a `multilingual` model as its 2nd constructor arg |
| `collection.controller.spec.ts` | `CollectionController` gained `AuditLogService`; `create`/`update`/`delete` gained a leading `@Req()` param |
| `content.controller.spec.ts` | gained `AuditLogService`, `SingleContentAssetService`, `AssetPipelineService`; `create`/`update`/`delete` gained `@Req()`; `getContentWord` went from `(res, lang, {limit})` to `(res, lang, limit, multilingual)`; `findById` became `findByIds` (comma-separated, calls `readByIds`, returns `{contents, count}`); HTTP enrichment moved into `contentService.enrichContentSourceData`; the catch block now returns the raw `error.message` instead of a wrapped "Server error" |
| `auth.guard.spec.ts` | `JwtAuthGuard` gained `cmsUserModel`; `request.user` is now enriched with `username`/`role`; `checkTokenStatus` returns `{ token, serviceUnavailable }` when the call *throws* |

**Two findings worth keeping:**

1. **One test was green for the wrong reason.** "authorization header with only Bearer prefix" passed only because the spec constructed the guard without a `cmsUserModel`, so it crashed on `undefined.findOne` and threw `UnauthorizedException` — the right exception for the wrong cause. With a real mock, `jose` implementations leaking from earlier tests (`jest.clearAllMocks()` clears calls but not implementations) let an empty token through. The test now sets its own `jwtDecrypt` rejection.
2. **`serviceUnavailable` applies only when the orchestration call throws.** A blanket edit briefly added it to the two tests where the API *responds* without a token — a genuinely different case that means the user is logged out. Reverted; the distinction is now explicit in the spec.

Also fixed a false positive in `context:check`: a bare extension in prose (`` `.spec.ts` ``) was reported as a broken path. Unresolvable dot-leading tokens with no directory part are now treated as extension mentions. Verified it still catches a real broken path.

**Step 5 — CI test gate, done 2026-09-02.** A `test` job was added to `.github/workflows/context-check.yml`, gated `if: github.event_name == 'pull_request'`. Tests are fully mocked (no DB or network) and run in ~14s, so the job is cheap.

PR-only was a deliberate choice, not a limitation: `git log` shows 8+ contributors and the 7 deployment workflows already fire on every push. A test job on every push would go red on unfinished work and teach people to ignore red builds. Added while the suite was green at 145/145 — a gate is only worth adding when it passes.

**Correction to an earlier claim in conversation:** adding a CI job was described as changing "what blocks a merge." Whether a red check blocks merging depends on GitHub branch protection, which could not be verified (`gh` is not installed). The job makes tests *run and report*; blocking is a separate repo setting.

**Residual gap:** a direct push to a branch still runs no tests, and the ~4,300 untested lines remain uncovered. Recorded as `docs/invariants.md` §4.9.

Step 1 is worth having even if 2 and 3 slip. Steps 2 and 3 are what stop the problem recurring.

---

## 14. Open questions for review

1. ✅ **RESOLVED 2026-09-02** — §7: project hooks go in **`.claude/settings.json`, committed**.
2. ✅ **RESOLVED 2026-09-02** — §10: `docs/AI_CONTEXT_BULK_UPLOAD.md` is **deleted** once Part 5's *why* content is migrated. Breakdown of what is kept vs discarded is in §10.1.
3. ✅ **RESOLVED 2026-09-02** — §4: `CLAUDE.md` reviewed and approved by the user. Created at 158 lines (cap 180).
4. ✅ **RESOLVED 2026-09-02** — §5.2: `docs/invariants.md` §5 "Rules not yet recorded" is left **empty** by the user's explicit decision. Nothing inferred into it.
5. ✅ **RESOLVED 2026-09-02** — line-number citations replaced with symbol references throughout `CLAUDE.md` and `docs/decisions/`. All 19 cited symbols verified present in the source. `context:check` (step 2) must verify symbol existence, not line numbers.

**No open questions remain.** Step 2 is unblocked.
