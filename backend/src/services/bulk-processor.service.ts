/**
 * ALL Content Service — Bulk Processor Service (Phase 4 + M1/M2 Read Along)
 *
 * Two-Pass Atomic Transaction architecture:
 *   Pass 1 — Memory & Validation (no S3, no FFmpeg, no gTTS, no MongoDB writes)
 *   Pass 2 — Execution (asset pipeline → builder → audio → upsert)
 *
 * Single-Template routing via wizard.templateType.
 * Multi-Tab Merging via the "Index Zip" pattern.
 * Recursive case-insensitive file scanning.
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as unzipper from 'unzipper';
import extractZip = require('extract-zip');
import sharp = require('sharp');
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import { collection } from 'src/schemas/collection.schema';
import { BulkUploadJob, BulkUploadJobDocument } from 'src/schemas/bulk-upload-job.schema';
import {
  BulkIngestService,
  WizardConfig,
  IngestionError,
  TemplateConfig,
  TEMPLATE_CONFIGS,
  readWorkbook,
  collectAssetRefs,
  findFileRecursively,
  findXlsxRecursively,
  ASSET_EXTENSIONS,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from 'src/services/bulk-ingest.service';
import { contentService } from 'src/services/content.service';
import { CollectionService } from 'src/services/collection.service';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_DIR        = process.env.STORAGE_DIR || '/tmp/bulk-uploads';
const MAX_ROWS           = 1000;
const S3_BUCKET          = 'all-dev-content-service';
const STALE_CUTOFF_MS    = 48 * 60 * 60 * 1000;
const RESUME_COOLDOWN_MS = 10_000;

/**
 * Languages natively supported by gtts@0.2.1.
 * kn, te, gu, ma are NOT in this list — the package throws before any HTTP
 * request. For those we call the Google Translate TTS API directly.
 */
const GTTS_SUPPORTED_LANGS = new Set([
  'af','sq','ar','hy','ca','zh','zh-cn','zh-tw','zh-yue','hr','cs','da','nl',
  'en','en-au','en-uk','en-us','eo','fi','fr','de','el','ht','hi','hu','is',
  'id','it','ja','ko','la','lv','mk','no','pl','pt','pt-br','ro','ru','sr',
  'sk','es','es-es','es-us','sw','sv','ta','th','tr','vi','cy',
]);

/**
 * Maps our internal language codes to the codes expected by Google Translate TTS.
 * Marathi: we store as 'ma' (ISO 639-2/B) but Google TTS uses 'mr' (ISO 639-1).
 */
const TTS_LANG_MAP: Readonly<Record<string, string>> = {
  ma: 'mr',
};

/**
 * Templates that use the M1/M2 Read Along schema:
 * same columns, same validation, same S3 routing, same auto-collection logic.
 */
const M1M2_STYLE_TEMPLATES = new Set([
  'M1 to M2 Read Along Content',
  'M3 Read Along Content',
]);

// ── M1/M2 Read Along script validation ──────────────────────────────────────

/** Allows English letters, digits, whitespace, and common punctuation. */
const M1M2_ENGLISH_REGEX = /^[a-zA-Z0-9\s.,!?'"()\-]+$/;

/**
 * Per-language script regexes for kn, te, hi, ta.
 * Each allows its Unicode block plus digits, whitespace, and common punctuation.
 */
const M1M2_SCRIPT_REGEXES: Readonly<Record<string, RegExp>> = {
  kn: /^[\u0C80-\u0CFF0-9\s.,!?'"()\-]+$/,  // Kannada
  te: /^[\u0C00-\u0C7F0-9\s.,!?'"()\-]+$/,  // Telugu
  hi: /^[\u0900-\u097F0-9\s.,!?'"()\-]+$/,  // Devanagari / Hindi
  ta: /^[\u0B80-\u0BFF0-9\s.,!?'"()\-]+$/,  // Tamil
};

/** Matches any M1/M2 multilingual column key: "multilingual {2-letter code} text|audio". */
const M1M2_ML_COL = /^multilingual ([a-z]{2}) (text|audio)$/;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single data row extracted from the Excel workbook.
 * Replaces the previous `Record<string, any>` alias with a safer index signature.
 */
interface ParsedExcelRow {
  /** Optional custom audio filename (treated specially during asset preprocessing). */
  audio_file?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** Typed representation of a single contentSourceData entry. */
interface ContentSourceDataItem {
  text?: string;
  audioUrl?: string;
  inst_audioUrl?: string;
  [key: string]: unknown;
}

/** Typed representation of one language entry inside payload.multilingual. */
interface MultilingualEntry {
  text?: string;
  audio_url?: string;
  image_url?: string;
  [key: string]: unknown;
}

/** Hint object attached to a mechanics_data entry. */
interface HintsEntry {
  text?: string;
  audio_url?: string;
  image_url?: string;
  [key: string]: unknown;
}

/** One option inside a mechanics exercise. */
interface MechanicsOption {
  text?: string;
  audio_url?: string;
  image_url?: string;
  isAns?: boolean;
  [key: string]: unknown;
}

/** One syllable chunk inside an M1_L mechanics entry. */
interface SyllableEntry {
  text?: string;
  audio_url?: string;
  [key: string]: unknown;
}

/** One item inside an M2_L imageAudioMap array. */
interface ImageAudioEntry {
  text?: string;
  audio_url?: string;
  image_url?: string;
  multilingual_id?: string;
  [key: string]: unknown;
}

/** A single entry inside payload.mechanics_data. */
interface MechanicsEntry {
  mechanics_id?: string;
  language?: string;
  text?: string;
  jumbled_text?: string;
  audio_url?: string;
  image_url?: string;
  time_limit?: number;
  options?: MechanicsOption[];
  hints?: HintsEntry;
  syllable?: SyllableEntry[];
  imageAudioMap?: ImageAudioEntry[];
  [key: string]: unknown;
}

/**
 * The assembled content/collection/multilingual payload passed to persistSingleRow.
 * Replaces the previous `Record<string, any>` alias.
 */
interface ContentPayload {
  contentId?: string;
  language?: string;
  collectionId?: string;
  multilingual_id?: string;
  contentSourceData?: ContentSourceDataItem[];
  multilingual?: Record<string, MultilingualEntry>;
  mechanics_data?: MechanicsEntry[];
  [key: string]: unknown;
}

/** A single failed-row entry accumulated during Pass 1 or Pass 2. */
interface FailedRowEntry {
  rowIndex: number;
  sheetName: string;
  error: string;
}

/**
 * Lean job document with timestamps injected at runtime by Mongoose `timestamps: true`.
 * These fields are not declared on the BulkUploadJob class but are always present
 * on documents retrieved from MongoDB.
 */
type JobStatusResult = BulkUploadJob & { createdAt: Date; updatedAt: Date };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isRowBlank(row: ParsedExcelRow | undefined): boolean {
  if (!row) return true;
  return Object.values(row).every(
    (v) => v === null || v === undefined || String(v).trim() === '',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BulkProcessorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BulkProcessorService.name);
  private s3: S3Client;

  constructor(
    @InjectModel(BulkUploadJob.name) private jobModel: Model<BulkUploadJobDocument>,
    @InjectModel(collection.name)    private collectionModel: Model<any>,
    private readonly bulkIngestService: BulkIngestService,
    private readonly contentService: contentService,
    private readonly collectionService: CollectionService,
  ) {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOT CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  async onApplicationBootstrap(): Promise<void> {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
        this.logger.log(`Created storage directory: ${STORAGE_DIR}`);
        return;
      }

      const entries = fs.readdirSync(STORAGE_DIR);
      const cutoff  = Date.now() - STALE_CUTOFF_MS;
      let cleaned   = 0;

      for (const entry of entries) {
        try {
          const fullPath = path.join(STORAGE_DIR, entry);
          const stat     = fs.statSync(fullPath);
          if (stat.mtimeMs < cutoff) {
            if (stat.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
            cleaned++;
          }
        } catch (err) {
          this.logger.warn(`Boot cleanup: failed to remove ${entry}: ${(err as Error).message}`);
        }
      }

      if (cleaned > 0) {
        this.logger.log(`Boot cleanup: removed ${cleaned} file(s)/folder(s) older than 48h`);
      }
    } catch (err) {
      this.logger.error(`Boot cleanup failed: ${(err as Error).message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATE & CREATE JOB
  // ═══════════════════════════════════════════════════════════════════════════

  async validateAndCreateJob(
    zipPath: string,
    wizard: WizardConfig,
    authToken: string = '',
    submittedBy?: { virtualId: number; username: string; role: string },
  ): Promise<{ jobId: string; totalRows: number }> {
    const config = TEMPLATE_CONFIGS[wizard.templateType];
    if (!config) {
      fs.unlinkSync(zipPath);
      throw new IngestionError(`Unknown templateType: '${wizard.templateType}'`);
    }

    const directory = await unzipper.Open.file(zipPath);
    const xlsxFile  = directory.files.find((f) => f.path.toLowerCase().endsWith('.xlsx'));
    if (!xlsxFile) {
      fs.unlinkSync(zipPath);
      throw new IngestionError('No .xlsx file found inside the ZIP bundle');
    }

    const xlsxBuffer = await xlsxFile.buffer();
    const sheetData  = await readWorkbook(xlsxBuffer);

    for (const expectedTab of config.expectedTabs) {
      if (!sheetData.has(expectedTab)) {
        fs.unlinkSync(zipPath);
        throw new IngestionError(
          `Missing required tab '${expectedTab}' for template '${wizard.templateType}'. ` +
          `Found tabs: [${[...sheetData.keys()].join(', ')}]`
        );
      }
    }

    // Guard against uploading a Mechanics file to a Read Along (or other) template.
    // If the Excel contains a mechanic-type tab that the selected template does not expect,
    // the user almost certainly chose the wrong template in the wizard.
    const MECHANIC_TAB_NAMES = new Set(['mechanic', 'fill in the blanks', 'mcq']);
    const expectedTabSet = new Set(config.expectedTabs);
    for (const sheetName of sheetData.keys()) {
      if (MECHANIC_TAB_NAMES.has(sheetName) && !expectedTabSet.has(sheetName)) {
        fs.unlinkSync(zipPath);
        throw new IngestionError(
          `Your Excel file contains a '${sheetName}' tab, but the selected template ` +
          `'${wizard.templateType}' does not expect it. ` +
          `Did you mean to select a Mechanics template?`
        );
      }
    }

    const primaryTab  = config.expectedTabs[0];
    const primaryRows = sheetData.get(primaryTab) ?? [];
    const totalRows   = primaryRows.length;

    if (totalRows > MAX_ROWS) {
      fs.unlinkSync(zipPath);
      throw new IngestionError(
        `Total rows (${totalRows}) exceeds maximum of ${MAX_ROWS}. ` +
        `Split your workbook into smaller batches.`
      );
    }
    if (totalRows === 0) {
      fs.unlinkSync(zipPath);
      throw new IngestionError('The primary tab contains no data rows.');
    }

    const mechTabs = config.expectedTabs.slice(1);
    for (const mechTab of mechTabs) {
      const mechRows = sheetData.get(mechTab) ?? [];
      if (mechRows.length > totalRows) {
        fs.unlinkSync(zipPath);
        throw new IngestionError(
          `Tab '${mechTab}' has ${mechRows.length} rows but primary tab has ${totalRows} — ` +
          `mechanic tabs must not have more rows than the primary tab.`
        );
      }
    }

    const jobId = uuidv4();
    await this.jobModel.create({
      jobId, status: 'PENDING', totalRows, processedRows: 0, failedRows: 0,
      wizardConfig: wizard, generatedCollections: {},
      zipFilename: path.basename(zipPath), authToken,
      ...(submittedBy ? { submittedBy } : {}),
    });

    this.logger.log(`Job ${jobId} created — ${totalRows} row(s), template '${wizard.templateType}'`);
    return { jobId, totalRows };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS & RESUME
  // ═══════════════════════════════════════════════════════════════════════════

  async getJobStatus(jobId: string): Promise<JobStatusResult | null> {
    return this.jobModel.findOne({ jobId }).lean();
  }

  async resumeJob(jobId: string): Promise<{ success: boolean; message: string; statusCode: number }> {
    const job = await this.jobModel.findOne({ jobId });
    if (!job) {
      return { success: false, message: 'Job not found', statusCode: 404 };
    }

    const canResume =
      job.status === 'FAILED' ||
      (job.status === 'COMPLETED' && (job.failedRows || 0) > 0);
    if (!canResume) {
      return {
        success: false,
        message: `Cannot resume — job status is '${job.status}' with no failed rows`,
        statusCode: 400,
      };
    }

    // updatedAt is injected by Mongoose timestamps:true — not reflected in the typed class
    const msSinceUpdate = Date.now() - new Date((job as BulkUploadJobDocument & { updatedAt: Date }).updatedAt).getTime();
    if (msSinceUpdate < RESUME_COOLDOWN_MS) {
      const secsLeft = Math.ceil((RESUME_COOLDOWN_MS - msSinceUpdate) / 1000);
      return {
        success: false,
        message: `Job was updated ${Math.floor(msSinceUpdate / 1000)}s ago. Wait ${secsLeft}s before resuming.`,
        statusCode: 409,
      };
    }

    const zipPath = path.join(STORAGE_DIR, job.zipFilename);
    if (!fs.existsSync(zipPath)) {
      return { success: false, message: 'ZIP file no longer exists on disk. Cannot resume.', statusCode: 410 };
    }

    job.status = 'PENDING';
    job.errorMessage = undefined;
    job.resumeCount = (job.resumeCount || 0) + 1;
    await job.save();

    this.processJobBackground(jobId).catch((err) => {
      this.logger.error(`Resume background processing failed for ${jobId}: ${(err as Error).message}`);
    });

    return { success: true, message: 'Job resumed', statusCode: 202 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TWO-PASS BACKGROUND PROCESSOR
  // ═══════════════════════════════════════════════════════════════════════════

  async processJobBackground(jobId: string, authToken?: string): Promise<void> {
    const job = await this.jobModel.findOne({ jobId });
    if (!job) { this.logger.error(`Job ${jobId} not found — aborting`); return; }

    const resolvedAuthToken: string = authToken || job.authToken || '';
    // wizardConfig is stored as Mixed (Record<string,any>) — cast to the typed interface
    const wizard: WizardConfig = job.wizardConfig as unknown as WizardConfig;
    const config = TEMPLATE_CONFIGS[wizard.templateType];
    if (!config) {
      job.status = 'FAILED';
      job.errorMessage = `Unknown templateType: '${wizard.templateType}'`;
      await job.save();
      return;
    }

    const zipPath    = path.join(STORAGE_DIR, job.zipFilename);
    const extractDir = path.join(STORAGE_DIR, `bulk-${jobId}-folder`);

    try {
      job.status = 'PROCESSING';
      await job.save();

      this.logger.log(`Job ${jobId}: extracting ZIP to ${extractDir}`);
      await extractZip(zipPath, { dir: extractDir });

      const xlsxPath = findXlsxRecursively(extractDir);
      if (!xlsxPath) throw new IngestionError('No .xlsx file found in extracted ZIP folder');

      // xlsx filename (without extension) is used as collection/content name for M1/M2
      const xlsxFilename = path.basename(xlsxPath, '.xlsx');

      const sheetData = await readWorkbook(xlsxPath);
      this.logger.log(`Job ${jobId}: tabs=[${[...sheetData.keys()].join(', ')}]`);

      for (const expectedTab of config.expectedTabs) {
        if (!sheetData.has(expectedTab)) {
          throw new IngestionError(
            `Missing required tab '${expectedTab}' for template '${wizard.templateType}'`
          );
        }
      }

      const primaryTabName = config.expectedTabs[0];
      const mechTabNames   = config.expectedTabs.slice(1);
      const primaryRows    = sheetData.get(primaryTabName)! as ParsedExcelRow[];
      const mechArrays     = mechTabNames.map((tab) => (sheetData.get(tab) ?? []) as ParsedExcelRow[]);

      for (let m = 0; m < mechArrays.length; m++) {
        if (mechArrays[m].length > primaryRows.length) {
          throw new IngestionError(
            `Tab '${mechTabNames[m]}' has ${mechArrays[m].length} rows but ` +
            `'${primaryTabName}' has ${primaryRows.length} — mechanic tabs must not exceed primary tab`
          );
        }
      }

      const contentIds = primaryRows.map(() => uuidv4());

      await this.runPass1Validation(job, jobId, primaryRows, mechArrays, wizard, contentIds, sheetData, extractDir, primaryTabName);
      await this.runPass2Execution(job, jobId, primaryRows, mechArrays, primaryTabName, contentIds, wizard, config, extractDir, resolvedAuthToken, xlsxFilename);

      this.logger.log(`Job ${jobId}: COMPLETED — ${primaryRows.length} total, ${job.failedRows} failed`);
      if ((job.failedRows || 0) === 0) {
        // All rows succeeded — safe to remove ZIP
        this.cleanupJobFiles(zipPath, extractDir);
      } else {
        // Keep ZIP on disk so the user can resume failed rows
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        this.logger.log(`Job ${jobId}: ZIP kept for resume (${job.failedRows} row(s) failed)`);
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId}: FAILED — ${errMsg}`);
      job.status       = 'FAILED';
      job.errorMessage = errMsg;
      await job.save();
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 1 — MEMORY & VALIDATION
  // No S3, no FFmpeg, no gTTS, no MongoDB writes.
  // ═══════════════════════════════════════════════════════════════════════════

  private async runPass1Validation(
    job: BulkUploadJobDocument,
    jobId: string,
    primaryRows: ParsedExcelRow[],
    mechArrays: ParsedExcelRow[][],
    wizard: WizardConfig,
    contentIds: string[],
    sheetData: ReturnType<typeof readWorkbook> extends Promise<infer T> ? T : never,
    extractDir: string,
    primaryTabName: string,
  ): Promise<void> {
    this.logger.log(`Job ${jobId}: Pass 1 — validating ${primaryRows.length} row(s)`);

    // For validation, replace any "will-be-created" collectionId with a placeholder UUID
    // so builders that embed collectionId into the payload produce a valid document shape.
    // Collection and Multilingual builders ignore wizard.collectionId entirely, so skip them.
    const isContentTemplate = TEMPLATE_CONFIGS[wizard.templateType]?.dbTarget === 'content';
    const willCreate = isContentTemplate &&
      (wizard.collectionId === 'AUTO' || wizard.collectionId.startsWith('NEW:'));
    const validationWizard: WizardConfig = {
      ...wizard,
      collectionId: willCreate ? 'PENDING_API_ID' : wizard.collectionId,
    };

    const validationErrors: FailedRowEntry[] = [];

    for (let i = 0; i < primaryRows.length; i++) {
      if (i < job.processedRows) continue;
      const rowIdx = i + 1;
      const mechRowsAtIndex = mechArrays.map((arr) => {
        const row = arr[i];
        return isRowBlank(row) ? undefined : row;
      });

      try {
        // M1/M2/M3 Read Along strict column + script validation
        if (M1M2_STYLE_TEMPLATES.has(wizard.templateType)) {
          this.validateM1M2Row(primaryRows[i], rowIdx);
        }
        // M4-M9 Read Along — zero-fail-fast column validation (no DB lookup)
        if (
          wizard.templateType === 'M4 to M6 Read Along Content' ||
          wizard.templateType === 'M7 to M9 Read Along Content'
        ) {
          this.validateM4ToM9ReadAlongRow(primaryRows[i], rowIdx);
        }
        // Textbook image mechanic — same as M7-M9 Read Along but image is required.
        // Combined try/catch collects errors from column validator AND buildPayloadForTemplate
        // (which does the multilingual_words DB lookup) so all issues appear in one report.
        if (wizard.templateType === 'Textbook image mechanic') {
          const tbErrors: string[] = [];
          try { this.validateTextbookImageMechanicRow(primaryRows[i], rowIdx); }
          catch (e) { tbErrors.push(e instanceof Error ? e.message : String(e)); }
          try {
            await this.bulkIngestService.buildPayloadForTemplate(
              wizard.templateType, primaryRows[i], mechRowsAtIndex,
              validationWizard, rowIdx, contentIds[i],
            );
          } catch (e) { tbErrors.push(e instanceof Error ? e.message : String(e)); }
          if (tbErrors.length > 0) throw new IngestionError(tbErrors.join(' • '));
        }
        // M1 Mechanics — validate BOTH tabs before throwing so the user sees all
        // errors in a single report rather than fix-and-re-upload cycles.
        if (wizard.templateType === 'M1 Mechanics Content') {
          const m1Errors: string[] = [];
          try { this.validateM1M2Row(primaryRows[i], rowIdx); }
          catch (e) { m1Errors.push(e instanceof Error ? e.message : String(e)); }
          try { this.validateM1MechanicTab(mechRowsAtIndex[0], rowIdx); }
          catch (e) { m1Errors.push(e instanceof Error ? e.message : String(e)); }
          if (m1Errors.length > 0) throw new IngestionError(m1Errors.join(' • '));
        }
        // M2 Mechanics — same combined pattern as M1 Mechanics above.
        if (wizard.templateType === 'M2 Mechanics Content') {
          const m2Errors: string[] = [];
          try { this.validateM1M2Row(primaryRows[i], rowIdx); }
          catch (e) { m2Errors.push(e instanceof Error ? e.message : String(e)); }
          try { this.validateM2MechanicTab(mechRowsAtIndex[0], rowIdx); }
          catch (e) { m2Errors.push(e instanceof Error ? e.message : String(e)); }
          if (m2Errors.length > 0) throw new IngestionError(m2Errors.join(' • '));
        }
        // M3 Mechanics — same combined pattern as M1/M2 Mechanics above.
        if (wizard.templateType === 'M3 Mechanics Content') {
          const m3Errors: string[] = [];
          try { this.validateM1M2Row(primaryRows[i], rowIdx); }
          catch (e) { m3Errors.push(e instanceof Error ? e.message : String(e)); }
          try { this.validateM3MechanicTab(mechRowsAtIndex[0], rowIdx); }
          catch (e) { m3Errors.push(e instanceof Error ? e.message : String(e)); }
          if (m3Errors.length > 0) throw new IngestionError(m3Errors.join(' • '));
        }
        // M4-M6 Mechanics — combined validator: read along + fill_in_blank + mcq tabs.
        // Each read along row must have data in at least one of fill_in_blank or mcq.
        if (wizard.templateType === 'M4 to M6 Mechanics Content') {
          const m4Errors: string[] = [];
          try { this.validateM4M9MechanicsReadAlongRow(primaryRows[i], rowIdx); }
          catch (e) { m4Errors.push(e instanceof Error ? e.message : String(e)); }
          if (!mechRowsAtIndex[0] && !mechRowsAtIndex[1]) {
            m4Errors.push(
              `Row ${rowIdx}: must have data in at least one of 'fill in the blanks' or 'mcq' tabs`,
            );
          }
          if (mechRowsAtIndex[0]) {
            try { this.validateFillInBlanksTab(mechRowsAtIndex[0], rowIdx); }
            catch (e) { m4Errors.push(e instanceof Error ? e.message : String(e)); }
          }
          if (mechRowsAtIndex[1]) {
            try { this.validateMcqTab(mechRowsAtIndex[1], rowIdx); }
            catch (e) { m4Errors.push(e instanceof Error ? e.message : String(e)); }
          }
          if (m4Errors.length > 0) throw new IngestionError(m4Errors.join(' • '));
        }
        // M7-M9 Mechanics — identical structure to M4-M6 Mechanics.
        if (wizard.templateType === 'M7 to M9 Mechanics Content') {
          const m7Errors: string[] = [];
          try { this.validateM4M9MechanicsReadAlongRow(primaryRows[i], rowIdx); }
          catch (e) { m7Errors.push(e instanceof Error ? e.message : String(e)); }
          if (!mechRowsAtIndex[0] && !mechRowsAtIndex[1]) {
            m7Errors.push(
              `Row ${rowIdx}: must have data in at least one of 'fill in the blanks' or 'mcq' tabs`,
            );
          }
          if (mechRowsAtIndex[0]) {
            try { this.validateFillInBlanksTab(mechRowsAtIndex[0], rowIdx); }
            catch (e) { m7Errors.push(e instanceof Error ? e.message : String(e)); }
          }
          if (mechRowsAtIndex[1]) {
            try { this.validateMcqTab(mechRowsAtIndex[1], rowIdx); }
            catch (e) { m7Errors.push(e instanceof Error ? e.message : String(e)); }
          }
          if (m7Errors.length > 0) throw new IngestionError(m7Errors.join(' • '));
        }
        // M10-M15 Mechanics — read along (same as M4-M9) + mechanic tab (mechanics_id + content_body).
        if (wizard.templateType === 'M10 to M15 Mechanics Content') {
          const m10Errors: string[] = [];
          try { this.validateM4M9MechanicsReadAlongRow(primaryRows[i], rowIdx); }
          catch (e) { m10Errors.push(e instanceof Error ? e.message : String(e)); }
          try { this.validateM10M15MechanicTab(mechRowsAtIndex[0], rowIdx); }
          catch (e) { m10Errors.push(e instanceof Error ? e.message : String(e)); }
          if (m10Errors.length > 0) throw new IngestionError(m10Errors.join(' • '));
        }
        // Generic asset-column-type check for templates that have no dedicated row
        // validator (Collection, Multilingual). All Mechanics and Read Along templates
        // are already covered by their per-row validators above.
        if (
          !M1M2_STYLE_TEMPLATES.has(wizard.templateType) &&
          wizard.templateType !== 'M4 to M6 Read Along Content' &&
          wizard.templateType !== 'M7 to M9 Read Along Content' &&
          wizard.templateType !== 'Textbook image mechanic' &&
          wizard.templateType !== 'M1 Mechanics Content' &&
          wizard.templateType !== 'M2 Mechanics Content' &&
          wizard.templateType !== 'M3 Mechanics Content' &&
          wizard.templateType !== 'M4 to M6 Mechanics Content' &&
          wizard.templateType !== 'M7 to M9 Mechanics Content' &&
          wizard.templateType !== 'M10 to M15 Mechanics Content'
        ) {
          const assetErrors: string[] = [];
          this.checkAssetColumnTypes(primaryRows[i], assetErrors);
          for (const mr of mechRowsAtIndex) {
            if (mr) this.checkAssetColumnTypes(mr, assetErrors);
          }
          if (assetErrors.length > 0) {
            throw new IngestionError(`Row ${rowIdx}: ${assetErrors.join(' • ')}`);
          }
        }
        // 'Textbook image mechanic' already called buildPayloadForTemplate inside its
        // combined try/catch block above — skip here to avoid a redundant double call.
        if (wizard.templateType !== 'Textbook image mechanic') {
          await this.bulkIngestService.buildPayloadForTemplate(
            wizard.templateType, primaryRows[i], mechRowsAtIndex,
            validationWizard, rowIdx, contentIds[i],
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Job ${jobId}: Pass 1 failed at row ${rowIdx}: ${errMsg}`);
        validationErrors.push({ rowIndex: rowIdx, sheetName: primaryTabName, error: errMsg });
      }
    }

    if (validationErrors.length > 0) {
      job.failedRowDetails = validationErrors;
      job.failedRows = validationErrors.length;
      job.markModified('failedRowDetails');
      await job.save();
      throw new IngestionError(
        `Data validation failed: ${validationErrors.length} row(s) had errors. ` +
        `Fix the highlighted rows and upload a new file.`,
      );
    }

    const allAssetRefs = collectAssetRefs(sheetData);
    for (const ref of allAssetRefs) {
      if (!findFileRecursively(extractDir, ref)) {
        throw new IngestionError(
          `Asset '${ref}' referenced in Excel but not found in ZIP (recursive case-insensitive search)`
        );
      }
    }
    this.logger.log(`Job ${jobId}: Pass 1 — complete, all ${allAssetRefs.size} asset(s) verified`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M1/M2 VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Entry point for M1/M2 row validation.
   * Accumulates ALL errors across every check before throwing once.
   * This gives users a complete picture of every problem in a single row.
   */
  private validateM1M2Row(row: ParsedExcelRow, _rowIdx: number): void {
    const rowErrors: string[] = [];

    this.checkM1M2RequiredColumns(row, rowErrors);
    this.checkAssetColumnTypes(row, rowErrors);

    // Normalize and validate the language value before any script checks
    const lang = normalizeLanguage(String(row['language'] ?? ''));
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      rowErrors.push(
        `Column 'language' contains an unsupported value '${lang}'. ` +
        `Allowed: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      );
      // Stop here — script checks depend on a valid language code
      throw new IngestionError(rowErrors.join(' • '));
    }

    const text = String(row['text'] ?? '').trim();

    if (lang === 'en') {
      // English main text script check (null-safe: only runs when text is non-empty)
      if (text && !M1M2_ENGLISH_REGEX.test(text)) {
        rowErrors.push(
          "Column 'text' must contain only English characters, numbers, spaces, " +
          'and standard punctuation (no Indic or special Unicode characters).',
        );
      }
      this.checkAtLeastOneMultilingualText(row, rowErrors);
      this.checkMultilingualScripts(row, rowErrors);
    } else if (text) {
      // Indic main text script check (null-safe: skipped when text is empty)
      this.checkIndicScript(lang, text, rowErrors, 'text');
    }

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  /** Pushes an error for every mandatory M1/M2 column that is missing or empty. */
  private checkM1M2RequiredColumns(row: ParsedExcelRow, rowErrors: string[]): void {
    const required: { col: string; display: string }[] = [
      { col: 'contenttype', display: 'contentType' },
      { col: 'text',        display: 'text' },
      { col: 'language',    display: 'language' },
      { col: 'tags',        display: 'tags' },
    ];
    for (const { col, display } of required) {
      if (!String(row[col] ?? '').trim()) {
        rowErrors.push(`Missing required column: ${display}`);
      }
    }
  }

  /**
   * Pushes an error if no multilingual text column has a value.
   * Scans ALL keys matching "multilingual {code} text" — works with any 2-letter language code.
   */
  private checkAtLeastOneMultilingualText(row: ParsedExcelRow, rowErrors: string[]): void {
    const hasAny = Object.keys(row).some(
      (key) => /^multilingual [a-z]{2} text$/.test(key) &&
               String(row[key] ?? '').trim() !== '',
    );
    if (!hasAny) {
      rowErrors.push(
        'English content requires at least one multilingual text column ' +
        '(e.g. multilingual kn text, multilingual gu text) to be filled.',
      );
    }
  }

  /**
   * Pushes an error for each non-empty multilingual text that fails its script regex.
   * Dynamically scans all "multilingual {code} text" keys. Languages without a
   * defined regex (gu, ma, or, …) are silently accepted.
   */
  private checkMultilingualScripts(row: ParsedExcelRow, rowErrors: string[]): void {
    for (const key of Object.keys(row)) {
      const match = M1M2_ML_COL.exec(key);
      if (!match || match[2] !== 'text') continue;
      const lang = match[1];
      const text = String(row[key] ?? '').trim();
      if (!text) continue; // null-safe: skip empty cells
      this.checkIndicScript(lang, text, rowErrors, key);
    }
  }

  /**
   * Pushes an error if `text` does not match the script regex for `lang`.
   * `columnName` is shown verbatim in the error so the user knows exactly which cell to fix.
   * Languages without a defined regex are silently accepted.
   */
  private checkIndicScript(lang: string, text: string, rowErrors: string[], columnName: string): void {
    const regex = M1M2_SCRIPT_REGEXES[lang];
    if (regex && !regex.test(text)) {
      rowErrors.push(
        `Column '${columnName}' does not match the ${lang} script. ` +
        `Ensure it contains only ${lang} characters, digits, spaces, and standard punctuation.`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M4-M6 READ ALONG VALIDATION HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Accumulates ALL validation errors for an M4-M6 Read Along row before
   * throwing once — identical zero-fail-fast pattern used by validateM1M2Row.
   * Does NOT query the database; DB state is irrelevant at validation time.
   */
  private validateM4ToM9ReadAlongRow(row: ParsedExcelRow, _rowIdx: number): void {
    const rowErrors: string[] = [];

    const required: { col: string; display: string }[] = [
      { col: 'contenttype', display: 'contentType' },
      { col: 'name',        display: 'name' },
      { col: 'text',        display: 'text' },
      { col: 'language',    display: 'language' },
      { col: 'tags',        display: 'tags' },
    ];
    for (const { col, display } of required) {
      if (!String(row[col] ?? '').trim()) {
        rowErrors.push(`Missing required column: ${display}`);
      }
    }

    const lang = normalizeLanguage(String(row['language'] ?? ''));
    if (row['language'] && !(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      rowErrors.push(
        `Column 'language' contains an unsupported value '${lang}'. ` +
        `Allowed: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      );
    }

    // multilingual_words is only used for English content — Indic languages skip this column
    if (lang === 'en') {
      const rawWords = String(row['multilingual_words'] ?? '').trim();
      const words = rawWords.split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);
      if (words.length === 0) {
        rowErrors.push("Column 'multilingual_words' must contain at least one word.");
      }
    }

    this.checkAssetColumnTypes(row, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXTBOOK IMAGE MECHANIC VALIDATOR
  // Same as M4-M9 Read Along but image is required.
  // ═══════════════════════════════════════════════════════════════════════════

  private validateTextbookImageMechanicRow(row: ParsedExcelRow, _rowIdx: number): void {
    const rowErrors: string[] = [];

    const required: { col: string; display: string }[] = [
      { col: 'contenttype', display: 'contentType' },
      { col: 'name',        display: 'name' },
      { col: 'text',        display: 'text' },
      { col: 'language',    display: 'language' },
      { col: 'tags',        display: 'tags' },
      { col: 'image',       display: 'image' },
    ];
    for (const { col, display } of required) {
      if (!String(row[col] ?? '').trim()) {
        rowErrors.push(`Missing required column: ${display}`);
      }
    }

    const lang = normalizeLanguage(String(row['language'] ?? ''));
    if (row['language'] && !(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      rowErrors.push(
        `Column 'language' contains an unsupported value '${lang}'. ` +
        `Allowed: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      );
    }

    this.checkAssetColumnTypes(row, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSET COLUMN TYPE VALIDATOR (all templates)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pushes an error for every cell where the file extension contradicts the
   * column's semantic type:
   *   - A column whose key contains 'image' must not receive an audio file.
   *   - A column whose key contains 'audio' must not receive an image file.
   *
   * Accumulates into the caller's `errors` array — never throws by itself so
   * it can be woven into any zero-fail-fast validator without breaking error
   * accumulation.
   */
  private checkAssetColumnTypes(row: ParsedExcelRow, errors: string[]): void {
    for (const [key, value] of Object.entries(row)) {
      if (!value || typeof value !== 'string') continue;
      const ext = path.extname(value).toLowerCase();
      const isAudioExt = BulkProcessorService.AUDIO_EXTS.has(ext);
      const isImageExt = BulkProcessorService.IMAGE_EXTS.has(ext);
      if (!isAudioExt && !isImageExt) continue;

      const k = key.toLowerCase();
      if (k.includes('image') && isAudioExt) {
        errors.push(
          `column '${key}' expects an image file (.png / .jpg / .jpeg) but received '${value}'`,
        );
      }
      if (k.includes('audio') && isImageExt) {
        errors.push(
          `column '${key}' expects an audio file (.wav / .mp3 / .m4a / .ogg) but received '${value}'`,
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M1 MECHANIC TAB VALIDATION HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates the mechanic tab row for M1 Mechanics Content.
   * Rules:
   *   1. mechanic tab must be present
   *   2. image is compulsory
   *   3. syllable_1_text is compulsory (at least one syllable required)
   *   4. syllables must be sequential — no gaps (syll_N+1 cannot be filled if syll_N is empty)
   */
  private validateM1MechanicTab(
    mechRow: ParsedExcelRow | undefined, rowIdx: number,
  ): void {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: mechanic tab row is missing for M1 Mechanics`);
    }

    const rowErrors: string[] = [];

    if (!String(mechRow['image'] ?? '').trim()) {
      rowErrors.push(`Missing required column in mechanic tab: image`);
    }

    if (!String(mechRow['syllable_1_text'] ?? '').trim()) {
      rowErrors.push(`Missing required column in mechanic tab: syllable_1_text — at least one syllable is required`);
    }

    // Sequential check: syllable_N+1 cannot be filled if syllable_N is empty
    for (let i = 1; i <= 2; i++) {
      const curr = String(mechRow[`syllable_${i}_text`]   ?? '').trim();
      const next = String(mechRow[`syllable_${i + 1}_text`] ?? '').trim();
      if (!curr && next) {
        rowErrors.push(
          `syllable_${i + 1}_text is filled but syllable_${i}_text is empty — ` +
          `syllables must be filled sequentially (no gaps)`
        );
      }
    }

    this.checkAssetColumnTypes(mechRow, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M2 MECHANIC TAB VALIDATION HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates the mechanic tab row for M2 Mechanics Content.
   * Rules:
   *   1. mechanic tab must be present
   *   2. All 5 text_N columns are required
   *   3. All 5 image_file_N columns are required
   *   4. Each text_N must be at least 2 characters (needed for unique split)
   */
  private validateM2MechanicTab(
    mechRow: ParsedExcelRow | undefined, rowIdx: number,
  ): void {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: mechanic tab row is missing for M2 Mechanics`);
    }

    const rowErrors: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const txt = String(mechRow[`text_${i}`] ?? '').trim();
      const img = String(mechRow[`image_file_${i}`] ?? '').trim();

      if (!txt) {
        rowErrors.push(`Missing required column in mechanic tab: text_${i}`);
      } else if (/\s/.test(txt)) {
        rowErrors.push(`text_${i} must be a single word with no spaces (got '${txt}')`);
      } else if (txt.length < 2) {
        rowErrors.push(`text_${i} must be at least 2 characters (got '${txt}')`);
      }

      if (!img) {
        rowErrors.push(`Missing required column in mechanic tab: image_file_${i}`);
      }
    }

    this.checkAssetColumnTypes(mechRow, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M3 MECHANIC TAB VALIDATION HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates the mechanic tab row for M3 Mechanics Content.
   * Rules:
   *   1. mechanic tab must be present
   *   2. 'correct text' — compulsory; must match one of the option texts (spaces ignored, case-insensitive)
   *   3. 'correct image' — compulsory
   *   4. text1 + image1 and text2 + image2 — all four compulsory
   *   5. text3 + image3 — optional but must be provided as a pair (not one without the other)
   *   6. Asset column type check (no audio in image columns, no image in audio columns)
   */
  private validateM3MechanicTab(
    mechRow: ParsedExcelRow | undefined, rowIdx: number,
  ): void {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: mechanic tab row is missing for M3 Mechanics`);
    }

    const rowErrors: string[] = [];

    if (!String(mechRow['correct text']  ?? '').trim()) {
      rowErrors.push(`Missing required column in mechanic tab: 'correct text'`);
    }
    if (!String(mechRow['correct image'] ?? '').trim()) {
      rowErrors.push(`Missing required column in mechanic tab: 'correct image'`);
    }

    // text1/image1 and text2/image2 are compulsory
    for (const i of [1, 2]) {
      if (!String(mechRow[`text${i}`]  ?? '').trim()) {
        rowErrors.push(`Missing required column in mechanic tab: text${i}`);
      }
      if (!String(mechRow[`image${i}`] ?? '').trim()) {
        rowErrors.push(`Missing required column in mechanic tab: image${i}`);
      }
    }

    // text3 + image3 are optional but must be provided as a pair
    const text3  = String(mechRow['text3']  ?? '').trim();
    const image3 = String(mechRow['image3'] ?? '').trim();
    if (text3 && !image3) {
      rowErrors.push(`text3 is filled but image3 is missing — provide both or neither`);
    }
    if (!text3 && image3) {
      rowErrors.push(`image3 is filled but text3 is missing — provide both or neither`);
    }

    // 'correct text' must match exactly ONE option text (case-insensitive; spaces normalized)
    const correctNorm = String(mechRow['correct text'] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (correctNorm) {
      const optionTexts = ['text1', 'text2', 'text3']
        .map((k) => String(mechRow[k] ?? '').replace(/\s+/g, ' ').trim().toLowerCase())
        .filter(Boolean);
      const matchCount = optionTexts.filter((t) => t === correctNorm).length;
      if (matchCount === 0) {
        rowErrors.push(
          `'correct text' does not match any of the option texts (text1, text2, text3) — ` +
          `ensure one of the option texts matches 'correct text' (spaces and case are ignored)`,
        );
      } else if (matchCount > 1) {
        rowErrors.push(
          `'correct text' matches multiple option texts — option texts must be unique`,
        );
      }
    }

    this.checkAssetColumnTypes(mechRow, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M4-M9 MECHANICS VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates the read along tab row for M4-M6 / M7-M9 Mechanics Content.
   * Like validateM1M2Row but WITHOUT the "at least one multilingual text" requirement
   * (M4-M9 Mechanics uses multilingual_id references, not inline translations).
   */
  private validateM4M9MechanicsReadAlongRow(row: ParsedExcelRow, _rowIdx: number): void {
    const rowErrors: string[] = [];
    const TAB = `'read along' tab`;

    const required: { col: string; display: string }[] = [
      { col: 'contenttype', display: 'contentType' },
      { col: 'text',        display: 'text' },
      { col: 'language',    display: 'language' },
      { col: 'tags',        display: 'tags' },
    ];
    for (const { col, display } of required) {
      if (!String(row[col] ?? '').trim()) {
        rowErrors.push(`[${TAB}] Missing required column: ${display}`);
      }
    }

    const lang = normalizeLanguage(String(row['language'] ?? ''));
    if (row['language'] && !(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      rowErrors.push(
        `[${TAB}] Column 'language' contains an unsupported value '${lang}'. ` +
        `Allowed: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      );
    }

    // multilingual_id is compulsory for English — at least one word required
    if (lang === 'en') {
      const mlWords = String(row['multilingual_id'] ?? '')
        .split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);
      if (mlWords.length === 0) {
        rowErrors.push(
          `[${TAB}] Column 'multilingual_id' is required for English content — ` +
          `provide at least one word from the text that exists in the multilingual collection`,
        );
      }
    }

    this.checkAssetColumnTypes(row, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  /**
   * Validates the fill_in_blank tab row for M4-M9 Mechanics Content (mechanic_1).
   * Rules:
   *   1. 'complete text' is required (TTS source)
   *   2. 'text with blank' is required (stored as mechanic.text)
   *   3. 'correct option' is required
   *   4. option1, option2, option3 are all required
   *   5. 'correct option' must match exactly ONE option (case-insensitive, spaces normalized)
   *   6. Asset column type check
   */
  private validateFillInBlanksTab(
    mechRow: ParsedExcelRow | undefined, rowIdx: number,
  ): void {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: 'fill in the blanks' tab row is missing for Mechanics`);
    }

    const rowErrors: string[] = [];
    const TAB = `'fill in the blanks' tab`;

    if (!String(mechRow['complete text']   ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'complete text'`);
    if (!String(mechRow['text with blank'] ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'text with blank'`);
    if (!String(mechRow['correct option']  ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'correct option'`);
    if (!String(mechRow['image']           ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'image'`);

    // option1 and option2 are compulsory; option3 is optional
    for (const i of [1, 2]) {
      if (!String(mechRow[`option${i}`] ?? '').trim()) {
        rowErrors.push(`[${TAB}] Missing required column: option${i}`);
      }
    }

    // 'correct option' must match exactly one of option1/option2/option3
    const correctNorm = String(mechRow['correct option'] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (correctNorm) {
      const optionTexts = [1, 2, 3]
        .map((i) => String(mechRow[`option${i}`] ?? '').replace(/\s+/g, ' ').trim().toLowerCase())
        .filter(Boolean);
      const matchCount = optionTexts.filter((t) => t === correctNorm).length;
      if (matchCount === 0) {
        rowErrors.push(
          `[${TAB}] 'correct option' does not match any of option1, option2, option3 — ` +
          `ensure one option text matches 'correct option' (spaces and case are ignored)`,
        );
      } else if (matchCount > 1) {
        rowErrors.push(`[${TAB}] 'correct option' matches multiple option texts — option texts must be unique`);
      }
    }

    this.checkAssetColumnTypes(mechRow, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  /**
   * Validates the mcq tab row for M4-M9 Mechanics Content (mechanic_2).
   * Rules:
   *   1. 'question text' is required
   *   2. 'correct text' is required
   *   3. option1, option2, option3 are all required
   *   4. 'correct text' must match exactly ONE option (case-insensitive, spaces normalized)
   *   5. Asset column type check
   */
  private validateMcqTab(
    mechRow: ParsedExcelRow | undefined, rowIdx: number,
  ): void {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: 'mcq' tab row is missing for Mechanics`);
    }

    const rowErrors: string[] = [];
    const TAB = `'mcq' tab`;

    if (!String(mechRow['question text'] ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'question text'`);
    if (!String(mechRow['correct text']  ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'correct text'`);
    if (!String(mechRow['image']         ?? '').trim()) rowErrors.push(`[${TAB}] Missing required column: 'image'`);

    // option1 and option2 are compulsory; option3 is optional
    for (const i of [1, 2]) {
      if (!String(mechRow[`option${i}`] ?? '').trim()) {
        rowErrors.push(`[${TAB}] Missing required column: option${i}`);
      }
    }

    // 'correct text' must match exactly one of option1/option2/option3
    const correctNorm = String(mechRow['correct text'] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (correctNorm) {
      const optionTexts = [1, 2, 3]
        .map((i) => String(mechRow[`option${i}`] ?? '').replace(/\s+/g, ' ').trim().toLowerCase())
        .filter(Boolean);
      const matchCount = optionTexts.filter((t) => t === correctNorm).length;
      if (matchCount === 0) {
        rowErrors.push(
          `[${TAB}] 'correct text' does not match any of option1, option2, option3 — ` +
          `ensure one option text matches 'correct text' (spaces and case are ignored)`,
        );
      } else if (matchCount > 1) {
        rowErrors.push(`[${TAB}] 'correct text' matches multiple option texts — option texts must be unique`);
      }
    }

    this.checkAssetColumnTypes(mechRow, rowErrors);

    if (rowErrors.length > 0) {
      throw new IngestionError(rowErrors.join(' • '));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M10-M15 MECHANICS VALIDATION HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates the mechanic tab row for M10-M15 Mechanics Content.
   * Rules:
   *   1. 'mechanics_id' is required (user-supplied, not static)
   *   2. 'content_body' is required and must be valid stringified JSON
   *   3. Parsed JSON must contain a non-empty 'data.tasks' array
   */
  private validateM10M15MechanicTab(
    mechRow: ParsedExcelRow | undefined, rowIdx: number,
  ): void {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: 'mechanic' tab row is required for M10-M15 Mechanics`);
    }

    const rowErrors: string[] = [];
    const TAB = `'mechanic' tab`;

    const mechanicsId = String(mechRow['mechanics_id'] ?? '').trim();
    const contentBody = String(mechRow['content_body'] ?? '').trim();

    if (!mechanicsId) rowErrors.push(`[${TAB}] Missing required column: 'mechanics_id'`);
    if (!contentBody) {
      rowErrors.push(`[${TAB}] Missing required column: 'content_body'`);
    } else {
      let parsed: any;
      try {
        parsed = JSON.parse(contentBody.replace(/\\"/g, '"'));
      } catch {
        rowErrors.push(`[${TAB}] 'content_body' must be valid stringified JSON`);
      }
      if (parsed !== undefined) {
        if (
          !parsed?.data?.tasks ||
          !Array.isArray(parsed.data.tasks) ||
          parsed.data.tasks.length === 0
        ) {
          rowErrors.push(
            `[${TAB}] 'content_body' JSON must contain a non-empty 'data.tasks' array`,
          );
        }
      }
    }

    if (rowErrors.length > 0) throw new IngestionError(rowErrors.join(' • '));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS 2 — EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  private async runPass2Execution(
    job: BulkUploadJobDocument,
    jobId: string,
    primaryRows: ParsedExcelRow[],
    mechArrays: ParsedExcelRow[][],
    primaryTabName: string,
    contentIds: string[],
    wizard: WizardConfig,
    config: TemplateConfig,
    extractDir: string,
    resolvedAuthToken: string,
    xlsxFilename: string,
  ): Promise<void> {
    this.logger.log(`Job ${jobId}: Pass 2 — executing`);

    // Three modes encoded in wizard.collectionId:
    //   'AUTO'        → create collection, name derived from xlsx or template+language
    //   'NEW:<name>'  → create collection, name explicitly provided by user
    //   '<uuid>'      → use existing collection as-is, no creation needed
    //
    // Collection and Multilingual templates ARE the top-level documents — they have
    // no parent collection and must never trigger collection creation here.
    const isContentTemplate     = config.dbTarget === 'content';
    const isAutoCollection      = wizard.collectionId === 'AUTO';
    const isNewNamed            = wizard.collectionId.startsWith('NEW:');
    const newCollectionName     = isNewNamed ? wizard.collectionId.slice(4).trim() : null;

    let realCollectionId = wizard.collectionId;

    if (isContentTemplate && (isAutoCollection || isNewNamed)) {
      if (M1M2_STYLE_TEMPLATES.has(wizard.templateType)) {
        // AUTO → xlsx filename; NEW → typed name
        const collName = isNewNamed ? newCollectionName! : xlsxFilename;
        realCollectionId = await this.createM1M2Collection(wizard, job, primaryRows, collName);
        job.resultCollectionName = collName;
      } else {
        // AUTO → template+language label; NEW → typed name
        realCollectionId = await this.createAutoCollection(wizard, job, newCollectionName ?? undefined);
        job.resultCollectionName = newCollectionName
          ?? `${wizard.templateType} — ${wizard.language} (auto-generated)`;
      }
    }

    // Track the final collection so the UI can show it on completion
    if (isContentTemplate) {
      job.resultCollectionId = realCollectionId;
      await job.save();
    }

    const executionWizard: WizardConfig = { ...wizard, collectionId: realCollectionId };
    const physicalUploadedFiles = new Set<string>();

    // Build the set of row indexes that previously failed so we can re-process them on resume
    const failedIndexes = new Set<number>((job.failedRowDetails || []).map((d) => d.rowIndex));

    for (let i = 0; i < primaryRows.length; i++) {
      const rowIdx = i + 1;

      // Skip rows that were already successfully processed (not in failedIndexes)
      if (i < job.processedRows && !failedIndexes.has(rowIdx)) continue;

      const mechRowsAtIndex = mechArrays.map((arr) => {
        const row = arr[i];
        return isRowBlank(row) ? undefined : row;
      });

      // If retrying a previously failed row, remove its stale error entry first
      if (failedIndexes.has(rowIdx)) {
        job.failedRowDetails = (job.failedRowDetails || []).filter((d) => d.rowIndex !== rowIdx);
        job.markModified('failedRowDetails');
        job.failedRows = Math.max(0, (job.failedRows || 0) - 1);
        failedIndexes.delete(rowIdx);
      }

      try {
        await this.processSingleRow(
          primaryRows[i], mechRowsAtIndex, rowIdx, contentIds[i],
          executionWizard, config, extractDir, resolvedAuthToken,
          physicalUploadedFiles, xlsxFilename,
        );
      } catch (err) {
        job.failedRows = (job.failedRows || 0) + 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        this.handleRowError(job, jobId, rowIdx, primaryTabName, errMsg);
        if (err instanceof IngestionError) throw err;
      }

      job.processedRows = Math.max(job.processedRows || 0, i + 1);
      if (job.processedRows % 10 === 0) await job.save();
    }

    job.processedRows = primaryRows.length;
    job.status        = 'COMPLETED';
    await job.save();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M1/M2 COLLECTION CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Computes the mode (most frequent value) of an array of strings.
   * Used to derive the dominant contentType for the auto-created collection.
   */
  private computeMode(values: string[]): string {
    if (values.length === 0) return '';
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let mode = values[0];
    let max  = 0;
    for (const [v, c] of counts) if (c > max) { max = c; mode = v; }
    return mode;
  }

  /** Builds the MongoDB payload for an M1/M2 collection (auto or named). */
  private buildM1M2CollectionPayload(
    wizard: WizardConfig, primaryRows: ParsedExcelRow[], collectionName: string,
  ): Record<string, unknown> {
    const language = normalizeLanguage(String(primaryRows[0]?.['language'] ?? wizard.language));
    const rawTypes = primaryRows.map((r) => String(r['contenttype'] ?? 'word').trim().toLowerCase());
    const mode     = this.computeMode(rawTypes);
    const category = mode ? mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase() : 'Word';
    return {
      name: collectionName, description: wizard.templateType, category,
      author: 'Ekstep', language, status: 'live', tags: wizard.tags || [],
      level_complexity: { level: '', level_competency: '' },
    };
  }

  /**
   * Creates the collection for an M1/M2/M3 Read Along job.
   * Resume-safe: returns the previously created collectionId if the job was restarted.
   *
   * collectionName sources:
   *   AUTO mode → xlsx filename (without extension)
   *   NEW mode  → user-typed name from wizard
   */
  private async createM1M2Collection(
    wizard: WizardConfig,
    job: BulkUploadJobDocument,
    primaryRows: ParsedExcelRow[],
    collectionName: string,
  ): Promise<string> {
    // Resume-safe cache key: use the collection name itself so resume finds
    // the same collection regardless of whether the name came from xlsx or user input
    const key = `m1m2:${collectionName}`;

    if (job.generatedCollections?.[key]) return job.generatedCollections[key];

    const collPayload = this.buildM1M2CollectionPayload(wizard, primaryRows, collectionName);
    const doc         = await this.collectionModel.create(collPayload);
    const realId      = doc.collectionId as string;

    job.generatedCollections = job.generatedCollections || {};
    job.generatedCollections[key] = realId;
    job.markModified('generatedCollections');
    await job.save();

    this.logger.log(`M1/M2 collection created: ${realId} (name="${collectionName}")`);
    return realId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESS SINGLE ROW (Pass 2 inner loop body)
  // ═══════════════════════════════════════════════════════════════════════════

  private async processSingleRow(
    primaryRow: ParsedExcelRow,
    mechRowsAtIndex: (ParsedExcelRow | undefined)[],
    rowIdx: number,
    contentId: string,
    wizard: WizardConfig,
    config: TemplateConfig,
    extractDir: string,
    resolvedAuthToken: string,
    physicalUploadedFiles: Set<string>,
    xlsxFilename: string,
  ): Promise<void> {
    // ── Step B: Preprocess secondary assets ──────────────────────────────────
    const resolvedLang = wizard.language;
    await this.preprocessRowAssets(primaryRow, extractDir, physicalUploadedFiles, resolvedLang, config.dbTarget);
    for (const mechRow of mechRowsAtIndex) {
      if (mechRow) await this.preprocessRowAssets(mechRow, extractDir, physicalUploadedFiles, resolvedLang, config.dbTarget);
    }

    // ── Step C: Build final payload ───────────────────────────────────────────
    const payload: ContentPayload = await this.bulkIngestService.buildPayloadForTemplate(
      wizard.templateType, primaryRow, mechRowsAtIndex, wizard, rowIdx, contentId,
    ) as ContentPayload;

    // M1/M2/M3 Read Along + all Mechanics: override name with xlsx filename.
    // These templates have no name column in the Excel — name is derived from the file.
    if (
      M1M2_STYLE_TEMPLATES.has(wizard.templateType) ||
      wizard.templateType === 'M1 Mechanics Content' ||
      wizard.templateType === 'M2 Mechanics Content' ||
      wizard.templateType === 'M3 Mechanics Content' ||
      wizard.templateType === 'M4 to M6 Mechanics Content' ||
      wizard.templateType === 'M7 to M9 Mechanics Content' ||
      wizard.templateType === 'M10 to M15 Mechanics Content'
    ) {
      payload.name = xlsxFilename;
    }

    // ── Steps D + E + F: Audio pipeline + enrichment (content rows only) ─────
    const isContentTemplate = config.dbTarget === 'content';
    if (isContentTemplate) {
      await this.processMainContentAudio(primaryRow, payload, wizard, extractDir, config, physicalUploadedFiles);
      await this.processSecondaryAudio(payload, wizard.language, physicalUploadedFiles, config.dbTarget);
      await this.enrichPayload(payload, wizard.language, resolvedAuthToken);
    }

    // ── Step G: MongoDB upsert ───────────────────────────────────────────────
    await this.persistSingleRow(config.dbTarget, payload);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENRICH PAYLOAD (Step F — non-fatal; content saved without enrichment data  
  //                 when the phoneme/LC service is unavailable or times out)                                                                                            
  // ═══════════════════════════════════════════════════════════════════════════

  private async enrichPayload(
    payload: ContentPayload,
    language: string,
    authToken: string,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    payload.contentSourceData = await this.contentService.enrichContentSourceData(
      payload.contentSourceData, language, authToken,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLE ROW ERROR (hard failure: logged + recorded; caller increments counter)
  // ═══════════════════════════════════════════════════════════════════════════

  private handleRowError(
    job: BulkUploadJobDocument, jobId: string,
    rowIdx: number, sheetName: string, errMsg: string,
  ): void {
    this.logger.error(`Job ${jobId}, row ${rowIdx}: ${errMsg}`);
    job.failedRowDetails = job.failedRowDetails || [];
    job.failedRowDetails.push({ rowIndex: rowIdx, sheetName, error: errMsg });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO COLLECTION — ONE per job (uses schema default for collectionId)
  // ═══════════════════════════════════════════════════════════════════════════

  private async createAutoCollection(
    wizard: WizardConfig, job: BulkUploadJobDocument, name?: string,
  ): Promise<string> {
    // Resume-safe cache key: named collections key by name; auto by template+language
    const collectionKey = name
      ? `new:${name}`
      : `auto:${wizard.templateType}:${wizard.language}`;

    if (job.generatedCollections?.[collectionKey]) {
      return job.generatedCollections[collectionKey];
    }

    const doc = await this.collectionModel.create({
      name:     name ?? `${wizard.templateType} — ${wizard.language} (auto-generated)`,
      category: 'Sentence',
      language: wizard.language,
      status:   wizard.status || 'live',
      tags:     [...wizard.tags],
      level_complexity: { level: '', level_competency: '' },
    });

    const realCollectionId = doc.collectionId;
    job.generatedCollections = job.generatedCollections || {};
    job.generatedCollections[collectionKey] = realCollectionId;
    job.markModified('generatedCollections');
    await job.save();

    this.logger.log(`Collection created: ${realCollectionId} (name="${name ?? 'auto-generated'}")`);
    return realCollectionId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSET NAMING PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  private static readonly IMAGE_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.tif', '.avif', '.bmp',
  ]);
  private static readonly AUDIO_EXTS = new Set([
    '.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.wma', '.webm', '.opus', '.aiff', '.aif',
  ]);

  /**
   * Rule 1 — ParsedExcelRow Mutation Strategy.
   * Scans every cell EXCEPT 'audio_file' (main content audio — handled by processMainContentAudio).
   * If the value is a string whose extension is in ASSET_EXTENSIONS, converts and uploads to S3.
   * Mutates the row cell in-place to just the UUID filename (no folder prefix).
   *
   * S3 folder routing hierarchy:
   *   A) Images (.png/.jpg/.jpeg)     → mechanics_images
   *   B) dbTarget === 'multilingual'  → multilingual_audios  (override for all audio)
   *   C) 'audio_file' or 'instruction_audio_file' → all-audio-files/${resolvedLanguage}
   *   D) key contains 'multilingual' AND 'audio'  → multilingual_audios
   *   E) all other audio              → mechanics_audios
   */
  private async preprocessRowAssets(
    row: ParsedExcelRow,
    extractDir: string,
    physicalUploadedFiles: Set<string>,
    resolvedLanguage: string,
    dbTarget: string,
  ): Promise<void> {
    for (const key of Object.keys(row)) {
      if (key === 'audio_file') continue; // handled by processMainContentAudio
      const value = row[key];
      if (typeof value !== 'string') continue;
      const ext = path.extname(value).toLowerCase();
      if (!ASSET_EXTENSIONS.has(ext)) continue;

      const assetId  = uuidv4();
      const isImage  = BulkProcessorService.IMAGE_EXTS.has(ext);
      const uuidName = isImage ? `${assetId}.png` : `${assetId}.wav`;

      // ── Determine S3 folder using strict routing hierarchy ────────────────
      let s3Folder: string;
      if (isImage) {
        s3Folder = 'mechanics_images';                                        // Rule A
      } else if (dbTarget === 'multilingual') {
        s3Folder = 'multilingual_audios';                                     // Rule B
      } else if (key === 'audio_file' || key === 'instruction_audio_file') {
        s3Folder = `all-audio-files/${resolvedLanguage}`;                     // Rule C
      } else if (key.includes('multilingual') && key.includes('audio')) {
        s3Folder = 'multilingual_audios';                                     // Rule D
      } else {
        s3Folder = 'mechanics_audios';                                        // Rule E
      }

      const s3Key = `${s3Folder}/${uuidName}`;

      try {
        const localPath = findFileRecursively(extractDir, value);
        if (!localPath) {
          this.logger.warn(`Asset '${value}' (key=${key}) not found on disk — registering UUID name without upload`);
          row[key] = uuidName;
          continue;
        }

        let body: Buffer;
        let contentType: string;
        if (isImage) {
          // Converts any image format to compressed RGBA PNG
          body = await this.processImage(localPath);
          contentType = 'image/png';
        } else {
          // Converts any audio format (mp3, ogg, m4a …) to PCM WAV
          const tmpWav = path.join(os.tmpdir(), uuidName);
          try {
            await this.convertToWav(localPath, tmpWav);
            body = fs.readFileSync(tmpWav);
          } finally {
            if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
          }
          contentType = 'audio/wav';
        }

        await this.s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET || S3_BUCKET,
          Key: s3Key, Body: body, ContentType: contentType,
        }));
        row[key] = uuidName;
        physicalUploadedFiles.add(uuidName);

      } catch (err) {
        throw new Error(
          `Asset pipeline failed for '${value}' (key=${key}): ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Rule 2 — Main Content Audio.
   * Runs AFTER the payload builder. Handles custom file or gTTS → ${contentId}.wav.
   *
   * S3 routing:
   *   dbTarget === 'multilingual'  →  multilingual_audios/${contentId}.wav
   *   otherwise                    →  all-audio-files/${language}/${contentId}.wav
   */
  private async processMainContentAudio(
    row: ParsedExcelRow,
    payload: ContentPayload,
    wizard: WizardConfig,
    extractDir: string,
    config: TemplateConfig,
    physicalUploadedFiles: Set<string>,
  ): Promise<void> {
    const contentId = payload.contentId;
    if (!contentId) return;

    const resolvedLang = (payload.language as string | undefined) ?? wizard.language;
    const wavFilename  = `${contentId}.wav`;
    const s3Key        = config.dbTarget === 'multilingual'
      ? `multilingual_audios/${wavFilename}`
      : `all-audio-files/${resolvedLang}/${wavFilename}`;

    const customFile = row['audio_file'];
    let tmpWavPath: string | null = null;
    let wavBuffer: Buffer | null = null;

    try {
      if (customFile && typeof customFile === 'string' && customFile.trim()) {
        const localPath = findFileRecursively(extractDir, customFile.trim());
        if (!localPath) {
          this.logger.warn(`Custom audio '${customFile}' not found for contentId=${contentId}`);
          return;
        }
        tmpWavPath = path.join(os.tmpdir(), wavFilename);
        await this.convertToWav(localPath, tmpWavPath);
        wavBuffer = fs.readFileSync(tmpWavPath);
        await this.s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET || S3_BUCKET,
          Key: s3Key, Body: wavBuffer, ContentType: 'audio/wav',
        }));
      } else {
        const text = payload.contentSourceData?.[0]?.text;
        if (!text) return;
        try {
          wavBuffer = await this.synthesizeAndUploadTTS(text, resolvedLang, s3Key);
        } catch (ttsErr) {
          throw new Error(
            `Auto-audio generation failed for language '${resolvedLang}': ` +
            `${(ttsErr as Error).message}. ` +
            `Please manually provide an audio file in the 'audio_file' column.`,
          );
        }
      }
    } catch (err) {
      if (tmpWavPath && fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
      throw err;
    } finally {
      if (tmpWavPath && fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
    }

    if (!wavBuffer) return;

    // For M4-M9 Mechanics, mechanic_3 (jumbled words) reuses the same audio but
    // expects it in mechanics_audios/ rather than all-audio-files/. Upload the
    // same buffer there now so processSecondaryAudio does not fall back to gTTS.
    const isM4M9Mechanics =
      wizard.templateType === 'M4 to M6 Mechanics Content' ||
      wizard.templateType === 'M7 to M9 Mechanics Content';
    if (isM4M9Mechanics) {
      await this.s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET || S3_BUCKET,
        Key: `mechanics_audios/${wavFilename}`, Body: wavBuffer, ContentType: 'audio/wav',
      }));
    }

    // Mark as physically uploaded so processSecondaryAudio skips gTTS for any
    // mechanic that references ${contentId}.wav (mechanic_3 in particular).
    physicalUploadedFiles.add(wavFilename);
  }

  /**
   * Reusable gTTS + FFmpeg + S3 helper.
   * Throws with the actual failure reason on all-retry exhaustion or S3 error.
   * Callers are responsible for wrapping with user-facing context.
   */
  private async synthesizeAndUploadTTS(text: string, lang: string, s3Key: string): Promise<Buffer> {
    const ttsLang    = TTS_LANG_MAP[lang] ?? lang;  // e.g. ma → mr
    const filename   = path.basename(s3Key);
    const tmpMp3Path = path.join(os.tmpdir(), filename.replace(/\.wav$/i, '.mp3'));
    const tmpWavPath = path.join(os.tmpdir(), filename);

    try {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

          if (GTTS_SUPPORTED_LANGS.has(ttsLang)) {
            // gtts@0.2.1 natively supports this language
            const gTTS = require('gtts');
            const tts  = new gTTS(text, ttsLang);
            await new Promise<void>((resolve, reject) =>
              tts.save(tmpMp3Path, (err: Error | null) => (err ? reject(err) : resolve())),
            );
          } else {
            // gtts@0.2.1 has an incomplete language list — kn, te, gu, ma are missing.
            // Call the Google Translate TTS API directly for these languages.
            const encoded = encodeURIComponent(text.slice(0, 200));
            const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${ttsLang}&client=gtx&ttsspeed=1`;
            const axiosLib = require('axios');
            const response = await axiosLib.get(url, {
              responseType: 'arraybuffer',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Content-Service-TTS/1.0)' },
              timeout: 15_000,
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            fs.writeFileSync(tmpMp3Path, response.data);
          }

          await this.convertToWav(tmpMp3Path, tmpWavPath);
          lastError = null;
          break;
        } catch (err) {
          lastError = err as Error;
          this.logger.warn(`TTS attempt ${attempt}/3 for s3Key=${s3Key} (lang=${lang}): ${lastError.message}`);
          if (fs.existsSync(tmpMp3Path)) fs.unlinkSync(tmpMp3Path);
          if (fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
        }
      }

      if (lastError) throw lastError;
      if (!fs.existsSync(tmpWavPath)) throw new Error('WAV file was not produced after TTS synthesis');

      const wavBuffer = fs.readFileSync(tmpWavPath);
      await this.s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET || S3_BUCKET,
        Key: s3Key, Body: wavBuffer, ContentType: 'audio/wav',
      }));
      return wavBuffer;
    } finally {
      if (fs.existsSync(tmpMp3Path)) fs.unlinkSync(tmpMp3Path);
      if (fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
    }
  }

  /**
   * Step E — TTS synthesis for all secondary audio:
   *   1. payload.multilingual entries (each in its own target language → multilingual_audios)
   *   2. payload.mechanics_data tree  (mechanic-level, hints, options, syllables, imageAudioMap)
   *      → multilingual_audios when dbTarget === 'multilingual', otherwise mechanics_audios
   * Only synthesizes .wav URLs that were NOT physically uploaded from the ZIP.
   */
  private async processSecondaryAudio(
    payload: ContentPayload,
    lang: string,
    physicalUploadedFiles: Set<string>,
    dbTarget: string,
  ): Promise<void> {
    // Multilingual inline translations — always stored in multilingual_audios,
    // synthesized in their OWN target language (not the primary `lang`)
    if (payload.multilingual && typeof payload.multilingual === 'object') {
      for (const [langKey, entry] of Object.entries(payload.multilingual)) {
        if (entry && typeof entry === 'object') {
          await this.maybeUploadTTS(entry, 'audio_url', entry.text, langKey, physicalUploadedFiles, {
            columnName:     `multilingual ${langKey} audio`,
            s3FolderPrefix: 'multilingual_audios',
          });
        }
      }
    }

    const mechanicsData = payload.mechanics_data;
    if (!Array.isArray(mechanicsData)) return;

    // Mechanics audio goes to multilingual_audios for the Multilingual Collection template,
    // and to mechanics_audios for all other content templates.
    const mechPrefix = dbTarget === 'multilingual' ? 'multilingual_audios' : 'mechanics_audios';

    for (const mechanic of mechanicsData) {
      const mechId = mechanic.mechanics_id ?? 'mechanic';
      // _ttsText: internal field set by M4/M7 builders when mechanic.text cannot be used as TTS
      // source (e.g. mechanic_1.text = fill-in-blank with ----, mechanic_3 has no .text at all).
      // Deleted here after use so it never reaches MongoDB.
      const ttsSource = (mechanic as any)._ttsText ?? mechanic.text;
      await this.maybeUploadTTS(mechanic, 'audio_url', ttsSource, lang, physicalUploadedFiles, {
        columnName:     `${mechId} audio`,
        s3FolderPrefix: mechPrefix,
      });
      delete (mechanic as any)._ttsText;
      if (mechanic.hints && typeof mechanic.hints === 'object') {
        await this.maybeUploadTTS(mechanic.hints, 'audio_url', mechanic.hints.text, lang, physicalUploadedFiles, {
          columnName:     `${mechId} hint audio`,
          s3FolderPrefix: mechPrefix,
        });
      }
      if (Array.isArray(mechanic.options)) {
        for (let i = 0; i < mechanic.options.length; i++) {
          const opt = mechanic.options[i];
          await this.maybeUploadTTS(opt, 'audio_url', opt.text, lang, physicalUploadedFiles, {
            columnName:     `${mechId} option ${i + 1} audio`,
            s3FolderPrefix: mechPrefix,
          });
        }
      }
      if (Array.isArray(mechanic.syllable)) {
        for (let i = 0; i < mechanic.syllable.length; i++) {
          const syl = mechanic.syllable[i];
          await this.maybeUploadTTS(syl, 'audio_url', syl.text, lang, physicalUploadedFiles, {
            columnName:     `syllable ${i + 1} audio`,
            s3FolderPrefix: mechPrefix,
          });
        }
      }
      if (Array.isArray(mechanic.imageAudioMap)) {
        for (const item of mechanic.imageAudioMap) {
          await this.maybeUploadTTS(item, 'audio_url', item.text, lang, physicalUploadedFiles, {
            columnName:     `imageAudioMap audio (${item.text ?? 'unknown'})`,
            s3FolderPrefix: mechPrefix,
          });
        }
      }
    }
  }

  /**
   * Checks a single audio_url field on an object. If it is a .wav filename
   * that was not physically uploaded, synthesizes TTS and uploads it.
   * Throws a user-friendly error on failure.
   */
  private async maybeUploadTTS(
    obj: Record<string, unknown>,
    field: string,
    text: string | undefined,
    lang: string,
    physicalUploadedFiles: Set<string>,
    options: { columnName: string; s3FolderPrefix: string },
  ): Promise<void> {
    const { columnName, s3FolderPrefix } = options;
    const filename: unknown = obj?.[field];
    if (typeof filename !== 'string' || !filename.endsWith('.wav')) return;
    if (physicalUploadedFiles.has(filename)) return;
    if (!text || typeof text !== 'string' || !text.trim()) {
      this.logger.warn(`No sibling text for TTS on field '${field}' (filename=${filename}) — skipping`);
      return;
    }
    try {
      await this.synthesizeAndUploadTTS(text.trim(), lang, `${s3FolderPrefix}/${filename}`);
    } catch (ttsErr) {
      throw new Error(
        `Auto-audio generation failed for column '${columnName}' (language: ${lang}): ` +
        `${(ttsErr as Error).message}. Please manually provide an audio file.`,
      );
    }
  }

  // ── Audio conversion helper ────────────────────────────────────────────────

  private async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    const ffmpeg = require('fluent-ffmpeg');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters('adelay=500|500')
        .audioCodec('pcm_s16le')
        .toFormat('wav')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });
  }

  // ── Image pipeline (sharp → compress <300KB, .png, RGBA) ──────────────────

  private async processImage(inputPath: string): Promise<Buffer> {
    const buf = await sharp(inputPath)
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .png({ palette: true, quality: 80, compressionLevel: 9 })
      .toBuffer();
    this.logger.log(`Processed image to ${Math.round(buf.length / 1024)} KB`);
    return buf;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DB PERSISTENCE (per-row insert — routed by dbTarget)
  // ═══════════════════════════════════════════════════════════════════════════

  private async persistSingleRow(dbTarget: string, payload: ContentPayload): Promise<void> {
    if (dbTarget === 'collection') {
      await this.collectionService.create(payload as any);
    } else if (dbTarget === 'multilingual') {
      await this.contentService.createMultilingual(payload as any);
    } else {
      await this.contentService.create(payload as any);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  private cleanupJobFiles(zipPath: string, extractDir: string): void {
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      this.logger.log('Cleaned up ZIP and extracted folder');
    } catch (err) {
      this.logger.warn(`Cleanup failed: ${(err as Error).message}`);
    }
  }
}
