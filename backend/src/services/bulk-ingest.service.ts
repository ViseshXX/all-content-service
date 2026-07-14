/**
 * ALL Content Service — Bulk Ingestion Service (Refactored Phase 4)
 *
 * Single-Template Architecture: routes by wizard.templateType, not sheet names.
 * All column/tab names are normalized to lowercase at parse time.
 * Builders accept separated rows for multi-tab merging.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';

import { multilingual } from 'src/schemas/multilingual.schema';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RawRow  = Record<string, any>;
type Payload = Record<string, any>;

export type TemplateType =
  | 'M1 to M2 Read Along Content'
  | 'M3 Read Along Content'
  | 'M4 to M6 Read Along Content'
  | 'M7 to M9 Read Along Content'
  | 'Textbook image mechanic'
  | 'M1 Mechanics Content'
  | 'M2 Mechanics Content'
  | 'M3 Mechanics Content'
  | 'M4 to M6 Mechanics Content'
  | 'M7 to M9 Mechanics Content'
  | 'M10 to M15 Mechanics Content'
  | 'Collection'
  | 'Multilingual';

export interface TemplateConfig {
  expectedTabs: string[];
  dbTarget: 'content' | 'collection' | 'multilingual';
  skipTagsCheck?: boolean;
}

export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  'M1 to M2 Read Along Content':  { expectedTabs: ['read along'], dbTarget: 'content' },
  'M3 Read Along Content':        { expectedTabs: ['read along'], dbTarget: 'content' },
  'M4 to M6 Read Along Content':  { expectedTabs: ['read along'], dbTarget: 'content' },
  'M7 to M9 Read Along Content':  { expectedTabs: ['read along'], dbTarget: 'content' },
  'Textbook image mechanic':      { expectedTabs: ['read along'], dbTarget: 'content' },
  'M1 Mechanics Content':         { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'M2 Mechanics Content':         { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'M3 Mechanics Content':         { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'M4 to M6 Mechanics Content':   { expectedTabs: ['read along', 'fill in the blanks', 'mcq'], dbTarget: 'content' },
  'M7 to M9 Mechanics Content':   { expectedTabs: ['read along', 'fill in the blanks', 'mcq'], dbTarget: 'content' },
  'M10 to M15 Mechanics Content': { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'Collection':                   { expectedTabs: ['collection'], dbTarget: 'collection', skipTagsCheck: true },
  'Multilingual':                 { expectedTabs: ['multilingual'], dbTarget: 'multilingual', skipTagsCheck: true },
};

export interface WizardConfig {
  collectionId:      string;
  language:          string;
  tags:              string[];
  status:            string;
  publisher:         string;
  target_lang_code:  string;
  templateType:      TemplateType;
  action:            'CREATE' | 'UPDATE';
}

interface MechanicsOption {
  text:      string;
  audio_url: string;
  image_url: string;
  isAns:     boolean;
}

interface MechanicsHint {
  text:      string;
  audio_url: string;
  image_url: string;
}

interface MechanicsEntry {
  mechanics_id:   string;
  language:       string;
  text?:          string;
  jumbled_text?:  string;
  audio_url?:     string;
  image_url?:     string;
  options?:       MechanicsOption[];
  correctness?:   { '50%': string[] };
  hints?:         MechanicsHint;
  time_limit?:    number;
  syllable?:      { text: string; audio_url: string }[];
  words?:         string[];
  imageAudioMap?: {
    text: string; audio_url: string; image_url: string; multilingual_id: string;
  }[];
  content_body?:  string;
  /** Internal field: TTS source text for processSecondaryAudio. Deleted before MongoDB save. */
  _ttsText?:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM ERROR
// ─────────────────────────────────────────────────────────────────────────────

export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const INDIC_REGEX = /[\u0900-\u0DFF\u1C80-\u1CFF\uA830-\uA83F]/;

/** Per-script regex for each supported Indic language code. */
const SCRIPT_REGEX: Readonly<Record<string, RegExp>> = {
  hi: /[\u0900-\u097F]/, // Devanagari (Hindi)
  ma: /[\u0900-\u097F]/, // Devanagari (Marathi)
  ta: /[\u0B80-\u0BFF]/, // Tamil
  te: /[\u0C00-\u0C7F]/, // Telugu
  kn: /[\u0C80-\u0CFF]/, // Kannada
  gu: /[\u0A80-\u0AFF]/, // Gujarati
};

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma'] as const;

/** Maps full language names → 2-letter codes for user-supplied language columns. */
const LANGUAGE_NORMALIZE_MAP: Readonly<Record<string, string>> = {
  english: 'en', hindi: 'hi', tamil: 'ta', telugu: 'te',
  kannada: 'kn', gujarati: 'gu', marathi: 'ma',
};

/**
 * Normalizes a language string to a 2-letter ISO code.
 * 'English' → 'en', 'kannada' → 'kn', 'en' → 'en', etc.
 * Unknown values are returned as-is (lowercased and trimmed).
 */
export function normalizeLanguage(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return LANGUAGE_NORMALIZE_MAP[lower] ?? lower;
}

function containsIndic(text: string): boolean {
  return INDIC_REGEX.test(text);
}

function validateUnicode(language: string, text: string, rowIdx: number): void {
  if (!text) return;
  if (language === 'en' && containsIndic(text)) {
    throw new IngestionError(
      `Row ${rowIdx}: Language mismatch — language is 'en' but text contains ` +
      `Indic characters: "${text.substring(0, 60)}..."`
    );
  }
  if (language !== 'en' && !containsIndic(text)) {
    throw new IngestionError(
      `Row ${rowIdx}: Language mismatch — language is '${language}' but text ` +
      `contains no Indic characters: "${text.substring(0, 60)}"`
    );
  }
}

/** Fisher-Yates shuffle — DO NOT CHANGE */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function cell(row: RawRow, col: string): string | null {
  const val = row[col];
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s !== '' ? s : null;
}

function cellList(row: RawRow, col: string): string[] {
  const val = cell(row, col);
  if (!val) return [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

// ── Audio pipeline placeholder ───────────────────────────────────────────────

async function generateAudioGtts(
  text: string, langCode: string, outputName: string,
): Promise<string> {
  console.log(
    `  [gTTS stub] Would synthesise "${text.substring(0, 40)}" ` +
    `(lang=${langCode}) → ${outputName} with 0.5 s silence pad`
  );
  return outputName;
}

/** DO NOT CHANGE — resolveAudio always returns {contentId}.wav */
export async function resolveAudio(
  contentId: string, audioSource: string | null, audioFile: string | null,
  text: string, langCode: string,
): Promise<string> {
  const wavName = `${contentId}.wav`;
  if (audioSource?.trim().toLowerCase() === 'custom' && audioFile?.trim()) {
    console.log(`  [ASSET MAP] Will rename custom file: "${audioFile.trim()}" → "${wavName}"`);
    return wavName;
  }
  await generateAudioGtts(text, langCode, wavName);
  return wavName;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZIP / EXCEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const ASSET_EXTENSIONS = new Set([
  // Audio — all converted to PCM WAV by fluent-ffmpeg
  '.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.wma', '.webm', '.opus', '.aiff', '.aif',
  // Image — all converted to PNG by sharp
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.tif', '.avif', '.bmp',
]);

export function collectAssetRefs(sheetData: Map<string, RawRow[]>): Set<string> {
  const refs = new Set<string>();
  for (const rows of sheetData.values()) {
    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (!val) continue;
        const s = String(val).trim();
        if (s && ASSET_EXTENSIONS.has(path.extname(s).toLowerCase())) {
          refs.add(s);
        }
      }
    }
  }
  return refs;
}

/**
 * Reads an Excel workbook and normalizes ALL tab names and column headers
 * to lowercase + trimmed. Returns Map<lowercaseTabName, RawRow[]>.
 */
/**
 * Converts any ExcelJS cell value to a plain string.
 * ExcelJS returns non-primitive types for rich text, formulas, hyperlinks, and errors.
 * Calling String() on these objects yields '[object Object]', which breaks blank-row
 * detection and column matching. This function normalises all types to text.
 */
export function excelCellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // Rich text: { richText: [{text: '...', font?: {}}] }
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((r) => r.text ?? '').join('');
    }
    // Formula result: { formula: '...', result: string|number|{error:...} }
    if ('result' in obj) return excelCellToString(obj.result);
    // Hyperlink: { text: '...', hyperlink: '...' }
    if ('text' in obj) return String(obj.text ?? '');
    // Error value: { error: '#REF!' }
    if ('error' in obj) return '';
  }
  return String(v);
}

export async function readWorkbook(source: string | Buffer): Promise<Map<string, RawRow[]>> {
  const wb = new ExcelJS.Workbook();
  if (Buffer.isBuffer(source)) {
    await wb.xlsx.load(source as any);
  } else {
    await wb.xlsx.readFile(source);
  }

  const sheetData = new Map<string, RawRow[]>();
  wb.eachSheet((ws) => {
    const rows: RawRow[] = [];
    let headers: string[] = [];
    let headerParsed = false;

    ws.eachRow({ includeEmpty: true }, (row) => {
      const values = (row.values as any[]).slice(1);
      if (!headerParsed) {
        // Skip blank rows that appear before the header row.
        const hasContent = values.some((v) => excelCellToString(v).trim() !== '');
        if (!hasContent) return;
        headers = values.map((v, i) => {
          const s = excelCellToString(v).trim().toLowerCase();
          return s !== '' ? s : `_col${i}`;
        });
        headerParsed = true;
        return;
      }
      // Normalise every cell to a plain string (or null).
      // This prevents rich text objects like {richText:[]} from causing issues.
      const normalised = values.map((v) => {
        const s = excelCellToString(v).trim();
        return s !== '' ? s : null;
      });
      // Always push — even blank rows — to preserve positional alignment between
      // the primary tab and mechanic tabs. Blank rows in mechanic tabs act as
      // placeholders meaning "no mechanic entry for this primary row". Skipping
      // them collapses the array and misaligns all subsequent rows.
      const rowObj: RawRow = {};
      headers.forEach((h, i) => { rowObj[h] = normalised[i] ?? null; });
      rows.push(rowObj);
    });
    // Trim trailing blank rows so mechanic tabs don't appear longer than the
    // primary tab due to empty rows at the bottom of the sheet.
    while (rows.length > 0 && Object.values(rows[rows.length - 1]).every(
      (v) => v === null || v === undefined || String(v).trim() === '',
    )) {
      rows.pop();
    }
    sheetData.set(ws.name.trim().toLowerCase(), rows);
  });
  return sheetData;
}

/**
 * Recursive case-insensitive file search.
 * No alias logic — exact case-insensitive match of the provided filename.
 */
export function findFileRecursively(directory: string, filename: string): string | null {
  const lowerFilename = filename.toLowerCase();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === lowerFilename) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findFileRecursively(fullPath, filename);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively find the first .xlsx file in a directory tree.
 */
export function findXlsxRecursively(directory: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.xlsx')) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findXlsxRecursively(fullPath);
      if (found) return found;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BulkIngestService {
  constructor(
    @InjectModel(multilingual.name) private multilingualModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC ROUTER — dispatches to the correct builder by templateType
  // ═══════════════════════════════════════════════════════════════════════════

  public async buildPayloadForTemplate(
    templateType: TemplateType,
    primaryRow: RawRow,
    mechRows: (RawRow | undefined)[],
    wizard: WizardConfig,
    rowIdx: number,
    contentId?: string,
  ): Promise<Payload> {
    switch (templateType) {
      case 'M1 to M2 Read Along Content':
        return this.buildM1M2Practice(primaryRow, wizard, rowIdx, contentId);
      case 'M3 Read Along Content':
        return this.buildM1M2Practice(primaryRow, wizard, rowIdx, contentId);
      case 'M4 to M6 Read Along Content':
        return this.buildM4M6ReadAlong(primaryRow, wizard, rowIdx, contentId);
      case 'M7 to M9 Read Along Content':
        return this.buildM7M9ReadAlong(primaryRow, wizard, rowIdx, contentId);
      case 'Textbook image mechanic':
        return this.buildTextbookImageMechanic(primaryRow, wizard, rowIdx, contentId);
      case 'M1 Mechanics Content':
        return this.buildM1Mechanic(primaryRow, mechRows[0], wizard, rowIdx, contentId);
      case 'M2 Mechanics Content':
        return this.buildM2Mechanic(primaryRow, mechRows[0], wizard, rowIdx, contentId);
      case 'M3 Mechanics Content':
        return this.buildM3Mechanic(primaryRow, mechRows[0], wizard, rowIdx, contentId);
      case 'M4 to M6 Mechanics Content':
        return this.buildM4M6Mechanics(primaryRow, mechRows[0], mechRows[1], wizard, rowIdx, contentId);
      case 'M7 to M9 Mechanics Content':
        return this.buildM7M9Mechanics(primaryRow, mechRows[0], mechRows[1], wizard, rowIdx, contentId);
      case 'M10 to M15 Mechanics Content':
        return this.buildM10M15Mechanics(primaryRow, mechRows[0], wizard, rowIdx, contentId);
      case 'Collection':
        return this.buildCollectionPayload(primaryRow, wizard);
      case 'Multilingual':
        return this.buildMultilingualPayload(primaryRow, wizard, rowIdx);
      default:
        throw new IngestionError(`Unknown template type: ${templateType}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A — REAL MONGOOSE MULTILINGUAL QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  private async validateMultilingualWords(words: string[], rowIdx: number): Promise<string[]> {
    const lowerWords = words.map((w) => w.toLowerCase());
    const docs = await this.multilingualModel.find({
      multilingual_id: { $in: lowerWords },
    }).lean();

    const foundIds = new Set(docs.map((d: any) => d.multilingual_id?.toLowerCase()));
    const missing = words.filter((w) => !foundIds.has(w.toLowerCase()));

    if (missing.length > 0) {
      throw new IngestionError(
        `Row ${rowIdx}: Two-Pass validation failed — word(s) not found in ` +
        `multilingual collection: [${missing.join(', ')}]. ` +
        `Add translations first via the Multilingual tab.`
      );
    }
    return words;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — SHARED BASE PAYLOAD BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildBasePayload(
    row: RawRow, wizard: WizardConfig, rowIdx: number,
    preContentId?: string,
  ): Promise<{ contentId: string; payload: Payload }> {
    const contentId = preContentId ?? uuidv4();
    const lang = wizard.language;
    const text = cell(row, 'text') ?? '';

    if (!text) {
      throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);
    }

    validateUnicode(lang, text, rowIdx);

    const audioUrl = await resolveAudio(
      contentId, cell(row, 'audio_source'), cell(row, 'audio_file'), text, lang,
    );

    const contentSourceEntry: Record<string, any> = { language: lang, audioUrl, text };
    const instAudio = cell(row, 'instruction_audio_file');
    if (instAudio) contentSourceEntry.inst_audioUrl = instAudio;

    // Mandatory row-level tags for all content templates
    const rowTags = cellList(row, 'tags');
    if (rowTags.length === 0) {
      throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);
    }

    // contentType is mandatory — must be supplied in the Excel row for every content template.
    // fixedContentType is kept as a parameter for schema documentation only; it is never
    // used as a silent fallback so that an empty cell always surfaces as a user-facing error.
    const rawType = cell(row, 'contenttype');
    if (!rawType) {
      throw new IngestionError(`Row ${rowIdx}: 'contentType' column is required`);
    }
    const contentType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const payload: Payload = {
      contentId,
      collectionId:      wizard.collectionId,
      name:              cell(row, 'name') ?? '',
      contentType,
      contentSourceData: [contentSourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      status:            cell(row, 'status')    ?? wizard.status,
      publisher:         cell(row, 'publisher') ?? wizard.publisher,
      language:          lang,
      contentIndex:      rowIdx,
      tags:              rowTags,
    };

    payload.imagePath = cell(row, 'image') ?? '';

    // ── Strict multilingual column parsing (M1-M3 translations) ─────────────
    // Columns: "multilingual {langCode} text", "multilingual {langCode} audio source",
    //          "multilingual {langCode} audio"
    for (const langCode of SUPPORTED_LANGUAGES) {
      const targetText = cell(row, `multilingual ${langCode} text`);
      if (!targetText) continue;

      const audioUrl = await resolveAudio(
        uuidv4(),
        cell(row, `multilingual ${langCode} audio source`),
        cell(row, `multilingual ${langCode} audio`),
        targetText,
        langCode, // CRITICAL: target language, not wizard.language
      );

      const mlEntry: Record<string, string> = { text: targetText, audio_url: audioUrl };
      const mlImg = cell(row, `multilingual ${langCode} image`);
      if (mlImg) mlEntry.image_url = mlImg;

      payload.multilingual = { ...(payload.multilingual ?? {}), [langCode]: mlEntry };
    }

    return { contentId, payload };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C — TEMPLATE BUILDERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── C.1  Collection ────────────────────────────────────────────────────────

  private buildCollectionPayload(row: RawRow, _wizard: WizardConfig): Payload {
    const errors: string[] = [];

    const name     = cell(row, 'name');
    const category = cell(row, 'category');
    const language = cell(row, 'language');
    const status   = cell(row, 'status');
    const tags     = cellList(row, 'tags');

    if (!name)             errors.push("'name' is required");
    if (!category)         errors.push("'category' is required");
    if (!language)         errors.push("'language' is required");
    if (!status)           errors.push("'status' is required");
    if (tags.length === 0) errors.push("'tags' is required");

    if (errors.length > 0) throw new IngestionError(`Collection: ${errors.join(' • ')}`);

    return {
      name:        name!,
      description: cell(row, 'description') ?? '',
      category:    category!,
      author:      cell(row, 'author')      ?? 'Ekstep',
      language:    language!,
      status:      status!,
      tags,
    };
  }

  // ── C.2  Multilingual ──────────────────────────────────────────────────────

  private async buildMultilingualPayload(
    row: RawRow, _wizard: WizardConfig, rowIdx: number,
  ): Promise<Payload> {
    const errors: string[] = [];

    const mid       = cell(row, 'multilingual_id');
    const contentId = cell(row, 'content_id');
    const imagePath = cell(row, 'image_path');

    if (!mid)       errors.push("'multilingual_id' is required");
    if (!contentId) errors.push("'content_id' is required");
    if (!imagePath) errors.push("'image_path' is required");

    const displayLangMap: Record<string, string> = {
      hindi: 'hi', tamil: 'ta', telugu: 'te',
      kannada: 'kn', gujarati: 'gu', marathi: 'ma',
    };

    const hasAtLeastOneLanguage = Object.keys(displayLangMap).some(
      (displayName) => !!cell(row, `${displayName}_text`),
    );
    if (!hasAtLeastOneLanguage) errors.push('at least one language text is required');

    if (errors.length > 0) throw new IngestionError(`Row ${rowIdx}: ${errors.join(' • ')}`);

    const ml: Record<string, any> = { content_id: contentId! };

    for (const [displayName, code] of Object.entries(displayLangMap)) {
      const text = cell(row, `${displayName}_text`);
      if (!text) continue;

      const scriptRegex = SCRIPT_REGEX[code];
      if (scriptRegex && !scriptRegex.test(text)) {
        errors.push(
          `'${displayName}_text' contains text that does not match the expected ${displayName} script: "${text.substring(0, 60)}"`,
        );
        continue;
      }

      const audioUrl = await resolveAudio(
        uuidv4(),
        null,
        cell(row, `${displayName}_audio`),
        text,
        code,
      );

      ml[code] = { text, audio_url: audioUrl, image_url: imagePath! };
    }

    if (errors.length > 0) throw new IngestionError(`Row ${rowIdx}: ${errors.join(' • ')}`);

    return { multilingual_id: mid!, multilingual: ml };
  }

  // ── C.3  M1-M2 Practice (single tab: Read Along) ──────────────────────────
  //
  // New column layout: contentType | language | text | audio_file | image |
  //                    instruction_audio_file | tags | multilingual {lang} text/audio
  // No audio_source, no name column (name set to xlsx filename by processor).
  // English content builds an embedded multilingual map by scanning ALL row keys
  // that match /^multilingual ([a-z]{2}) text$/. Indic content omits multilingual.

  private async buildM1M2Practice(
    row: RawRow, wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    const id       = contentId ?? uuidv4();
    const lang     = normalizeLanguage(cell(row, 'language') ?? wizard.language);
    const rawType  = cell(row, 'contenttype') ?? 'Word';
    const contType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
    const text     = cell(row, 'text');
    if (!text) throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);
    const tags = cellList(row, 'tags');
    if (tags.length === 0) throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);

    const sourceEntry = this.buildM1M2ContentSource(row, id, lang, text);
    const ml          = lang === 'en' ? this.buildM1M2MultilingualMap(row) : undefined;
    return this.assembleM1M2Payload(id, wizard, rowIdx, contType, lang, tags, sourceEntry, row, ml);
  }

  /** Builds the contentSourceData[0] entry for M1/M2. audioUrl is always ${id}.wav. */
  private buildM1M2ContentSource(
    row: RawRow, id: string, lang: string, text: string,
  ): Record<string, string> {
    const entry: Record<string, string> = { language: lang, text, audioUrl: `${id}.wav` };
    const inst = cell(row, 'instruction_audio_file');
    if (inst) entry.inst_audioUrl = inst;
    return entry;
  }

  /**
   * Builds the embedded multilingual map for English M1/M2 content.
   * Dynamically scans ALL row keys matching /^multilingual ([a-z]{2}) text$/.
   * Supports any 2-letter language code present in the spreadsheet (kn, te, hi, ta, gu, ma, or, …).
   * If the paired audio column is blank, a UUID.wav is pre-assigned for TTS generation.
   */
  private buildM1M2MultilingualMap(
    row: RawRow,
  ): Record<string, { text: string; audio_url: string }> {
    const ML_TEXT_KEY = /^multilingual ([a-z]{2}) text$/;
    const ml: Record<string, { text: string; audio_url: string }> = {};
    for (const key of Object.keys(row)) {
      const match = ML_TEXT_KEY.exec(key);
      if (!match) continue;
      const code    = match[1];
      const mlText  = cell(row, key);
      if (!mlText) continue;
      const audioFile = cell(row, `multilingual ${code} audio`);
      ml[code] = { text: mlText, audio_url: audioFile ?? `${uuidv4()}.wav` };
    }
    return ml;
  }

  /** Assembles the final ContentPayload for M1/M2. name is '' — overridden by processor. */
  private assembleM1M2Payload(
    id: string, wizard: WizardConfig, rowIdx: number,
    contentType: string, lang: string, tags: string[],
    sourceEntry: Record<string, string>, row: RawRow,
    multilingual?: Record<string, { text: string; audio_url: string }>,
  ): Payload {
    const payload: Payload = {
      contentId: id, collectionId: wizard.collectionId,
      name: '',        // overridden by processor with xlsx filename
      contentType, contentSourceData: [sourceEntry],
      level_complexity: { level: '', level_competency: '' },
      status: 'live', publisher: 'ekstep', language: lang,
      contentIndex: rowIdx, tags,
    };
    payload.imagePath = cell(row, 'image') ?? '';
    if (multilingual && Object.keys(multilingual).length > 0) payload.multilingual = multilingual;
    return payload;
  }

  // ── C.5  M4-M6 Read Along (single tab, Two-Pass multilingual) ─────────────

  private async buildM4M6ReadAlong(
    row: RawRow, wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    const { payload } = await this.buildBasePayload(row, wizard, rowIdx, contentId);

    // multilingual_words is only applicable for English content
    if (wizard.language === 'en') {
      const rawWords = cell(row, 'multilingual_words') ?? '';
      const words    = rawWords.split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);
      if (words.length === 0) {
        throw new IngestionError(
          `Row ${rowIdx}: Column 'multilingual_words' must contain at least one word.`
        );
      }
      const validated = await this.validateMultilingualWords(words, rowIdx);
      payload.contentSourceData[0].multilingual_id = validated;
    }

    return payload;
  }

  // ── C.6  M7-M9 Read Along (single tab, Two-Pass multilingual) ─────────────

  private async buildM7M9ReadAlong(
    row: RawRow, wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    const { payload } = await this.buildBasePayload(row, wizard, rowIdx, contentId);

    // multilingual_words is only applicable for English content
    if (wizard.language === 'en') {
      const rawWords = cell(row, 'multilingual_words') ?? '';
      const words    = rawWords.split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);
      if (words.length === 0) {
        throw new IngestionError(
          `Row ${rowIdx}: Column 'multilingual_words' must contain at least one word.`
        );
      }
      const validated = await this.validateMultilingualWords(words, rowIdx);
      payload.contentSourceData[0].multilingual_id = validated;
    }

    return payload;
  }

  // ── C.6b  Textbook image mechanic (1 tab: Read Along, image required) ────────
  //
  // Same as M7-M9 Read Along but image is compulsory.
  // Read Along tab columns:
  //   contentType | language | text | audio_file | name | tags | image (required)
  //   + multilingual_words for English only
  //
  private async buildTextbookImageMechanic(
    row: RawRow, wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    const { payload } = await this.buildBasePayload(row, wizard, rowIdx, contentId);

    // multilingual_words is only applicable for English content (same as M7-M9)
    if (wizard.language === 'en') {
      const rawWords = cell(row, 'multilingual_words') ?? '';
      const words    = rawWords.split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);
      if (words.length === 0) {
        throw new IngestionError(
          `Row ${rowIdx}: Column 'multilingual_words' must contain at least one word.`
        );
      }
      const validated = await this.validateMultilingualWords(words, rowIdx);
      payload.contentSourceData[0].multilingual_id = validated;
    }

    return payload;
  }

  // ── C.7  M1 Mechanic (2 tabs: Read Along + Mechanic) ──────────────────────
  //
  // Read Along tab columns (same structure as M1-M3 Read Along):
  //   contentType | language | text | audio_file | tags | image
  //   + multilingual {lang} text/audio for English only
  //
  // Mechanic tab columns:
  //   image (compulsory) | syllable_1_text | syllable_1_audio_file |
  //   syllable_2_text | syllable_2_audio_file | syllable_3_text | syllable_3_audio_file
  //
  // Static fields (not in Excel): status='live', publisher='ekstep',
  //   mechanics_id='M1_L', inst_audioUrl (not needed)
  // name — set to xlsx filename by processor (same as M1-M3 Read Along)

  private async buildM1Mechanic(
    readAlongRow: RawRow, mechRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: Mechanic tab data is required for M1 Mechanics`);
    }

    const id  = contentId ?? uuidv4();
    // Language from per-row column — same normalize logic as M1-M3 Read Along.
    // Supports short codes ('en', 'kn') and full names ('english', 'kannada').
    const lang = normalizeLanguage(cell(readAlongRow, 'language') ?? wizard.language);

    const rawType  = cell(readAlongRow, 'contenttype') ?? 'Word';
    const contType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const text = cell(readAlongRow, 'text');
    if (!text) throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);

    const tags = cellList(readAlongRow, 'tags');
    if (tags.length === 0) throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);

    // audioUrl: processor handles TTS or physical file upload — set placeholder UUID here
    const sourceEntry: Record<string, any> = { language: lang, text, audioUrl: `${id}.wav` };
    // inst_audioUrl intentionally omitted — not needed per spec

    // Multilingual: English only, same as M1-M3 Read Along.
    // Validation that at least 1 is filled is done by validateM1M2Row in the processor.
    const ml = lang === 'en' ? this.buildM1M2MultilingualMap(readAlongRow) : undefined;

    // mechanic tab: image is compulsory
    const mechImg = cell(mechRow, 'image');
    if (!mechImg) {
      throw new IngestionError(
        `Row ${rowIdx}: 'image' is required in the mechanic tab for M1 Mechanics (M1_L)`
      );
    }

    // Syllables: sequential, no gaps, at least 1 already validated by validateM1MechanicTab.
    // Use direct UUID assignment — processor's processSecondaryAudio handles TTS or file upload.
    const syllables: { text: string; audio_url: string }[] = [];
    for (let i = 1; i <= 3; i++) {
      const sylText = cell(mechRow, `syllable_${i}_text`);
      if (!sylText) break; // safe — sequential check already enforced in Pass 1
      syllables.push({
        text:      sylText,
        audio_url: cell(mechRow, `syllable_${i}_audio_file`) ?? `${uuidv4()}.wav`,
      });
    }

    const mechEntry: MechanicsEntry = {
      mechanics_id: 'M1_L',
      language:     lang,   // same value as read along language
      image_url:    mechImg,
      syllable:     syllables,
    };

    const payload: Payload = {
     
     
     
      contentId:         id,
      collectionId:      wizard.collectionId,
      name:              '',       // overridden by processor with xlsx filename
      contentType:       contType,
      contentSourceData: [sourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      status:            'live',   // static per spec
      publisher:         'ekstep', // static per spec
      language:          lang,
      contentIndex:      rowIdx,
      tags,
      mechanics_data:    [mechEntry],
    };

    payload.imagePath = cell(readAlongRow, 'image') ?? '';

    if (ml && Object.keys(ml).length > 0) payload.multilingual = ml;

    return payload;
  }

  // ── C.8  M2 Mechanic (2 tabs: Read Along + Mechanic) ──────────────────────
  // Spec: per-row language; same read along as M1 Mechanics; mechanics_id='M2_L';
  // image_url='' (static); words auto-generated by splitting each of 5 imageAudioMap
  // texts into 2 unique parts then Fisher-Yates shuffled; all 5 imageAudioMap entries
  // compulsory (text_N, image_file_N required; audio_file_N optional → TTS);
  // multilingual_id = text value (auto-set); status/publisher static; name=xlsx filename.

  /**
   * Splits `text` into two non-empty parts at a position chosen from the middle
   * outward, ensuring neither part has been used before (case-insensitive comparison
   * against `usedParts`). Both chosen parts are added to `usedParts` on success.
   */
  private splitWordUnique(text: string, usedParts: Set<string>): [string, string] {
    const len = text.length;
    if (len < 2) {
      throw new IngestionError(
        `imageAudioMap text '${text}' is too short to split into 2 unique parts (minimum 2 characters required)`,
      );
    }
    const mid = Math.floor(len / 2);
    // Try split positions from the middle outward so we prefer balanced splits.
    const positions: number[] = [];
    for (let offset = 0; offset < len; offset++) {
      if (mid + offset < len)      positions.push(mid + offset);
      if (offset > 0 && mid - offset >= 1) positions.push(mid - offset);
    }
    for (const pos of positions) {
      const p1 = text.slice(0, pos).toLowerCase();
      const p2 = text.slice(pos).toLowerCase();
      if (p1 && p2 && !usedParts.has(p1) && !usedParts.has(p2)) {
        usedParts.add(p1);
        usedParts.add(p2);
        return [text.slice(0, pos), text.slice(pos)];
      }
    }
    throw new IngestionError(
      `Cannot split '${text}' into 2 unique parts — all possible splits produce duplicates with earlier imageAudioMap entries`,
    );
  }

  private async buildM2Mechanic(
    readAlongRow: RawRow, mechRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: Mechanic tab data is required for M2 Mechanics`);
    }

    const id   = contentId ?? uuidv4();
    const lang = normalizeLanguage(cell(readAlongRow, 'language') ?? wizard.language);

    const rawType  = cell(readAlongRow, 'contenttype') ?? 'Word';
    const contType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const text = cell(readAlongRow, 'text');
    if (!text) throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);

    const tags = cellList(readAlongRow, 'tags');
    if (tags.length === 0) throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);

    const sourceEntry: Record<string, any> = { language: lang, text, audioUrl: `${id}.wav` };

    // Multilingual: English only, same as M1 Mechanics / M1-M3 Read Along.
    const ml = lang === 'en' ? this.buildM1M2MultilingualMap(readAlongRow) : undefined;

    // Build imageAudioMap from text_N / audio_file_N / image_file_N (exactly 5, all compulsory).
    // Simultaneously accumulate 2 unique word-parts per entry for the auto-generated words array.
    const imageAudioMap: MechanicsEntry['imageAudioMap'] = [];
    const usedParts = new Set<string>();
    const wordParts: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const entryText = cell(mechRow, `text_${i}`);
      const audioFile = cell(mechRow, `audio_file_${i}`);
      const imageFile = cell(mechRow, `image_file_${i}`);

      if (!entryText) {
        throw new IngestionError(`Row ${rowIdx}: 'text_${i}' is required in mechanic tab for M2 Mechanics`);
      }
      if (!imageFile) {
        throw new IngestionError(`Row ${rowIdx}: 'image_file_${i}' is required in mechanic tab for M2 Mechanics`);
      }

      const [p1, p2] = this.splitWordUnique(entryText, usedParts);
      wordParts.push(p1, p2);

      imageAudioMap.push({
        text:            entryText,
        audio_url:       audioFile ?? `${uuidv4()}.wav`, // TTS if no file provided
        image_url:       imageFile,
        multilingual_id: entryText, // auto-set to text value per spec
      });
    }

    // Fisher-Yates shuffle of all 10 word parts — DO NOT CHANGE
    const shuffledWords = shuffleArray(wordParts);

    const mechEntry: MechanicsEntry = {
      mechanics_id: 'M2_L',
      language:     lang,
      image_url:    '', // static per spec
      words:        shuffledWords,
      imageAudioMap,
    };

    const payload: Payload = {
      contentId:         id,
      collectionId:      wizard.collectionId,
      name:              '',       // overridden by processor with xlsx filename
      contentType:       contType,
      contentSourceData: [sourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      status:            'live',   // static per spec
      publisher:         'ekstep', // static per spec
      language:          lang,
      contentIndex:      rowIdx,
      tags,
      mechanics_data:    [mechEntry],
    };

    payload.imagePath = cell(readAlongRow, 'image') ?? '';

    if (ml && Object.keys(ml).length > 0) payload.multilingual = ml;

    return payload;
  }

  // ── C.9  M3 Mechanic (2 tabs: Read Along + Mechanic) ──────────────────────
  // Spec: per-row language; same read along as M1/M2 Mechanics; mechanics_id='M3_L'
  // (static); outer image_url from 'correct image' column (compulsory); options built
  // from text1/image1 … text3/image3 (text1+image1+text2+image2 compulsory, text3+image3
  // optional pair); isAns derived by matching option text against 'correct text' column
  // (case-insensitive, spaces ignored); audio_url='' for every option (static);
  // multilingual same as M1/M2 Mechanics (English only, ≥1 required); status/publisher
  // static; name set to xlsx filename by processor.

  private async buildM3Mechanic(
    readAlongRow: RawRow, mechRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: Mechanic tab data is required for M3 Mechanics`);
    }

    const id   = contentId ?? uuidv4();
    const lang = normalizeLanguage(cell(readAlongRow, 'language') ?? wizard.language);

    const rawType  = cell(readAlongRow, 'contenttype') ?? 'Sentence';
    const contType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const text = cell(readAlongRow, 'text');
    if (!text) throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);

    const tags = cellList(readAlongRow, 'tags');
    if (tags.length === 0) throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);

    const sourceEntry: Record<string, any> = { language: lang, text, audioUrl: `${id}.wav` };
    // inst_audioUrl intentionally omitted — not needed per spec

    // Multilingual: English only, same as M1/M2 Mechanics / M1-M3 Read Along.
    const ml = lang === 'en' ? this.buildM1M2MultilingualMap(readAlongRow) : undefined;

    // 'correct text' column — used to derive isAns; already validated by validateM3MechanicTab
    const correctText = (cell(mechRow, 'correct text') ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Build options from text1/image1 … text3/image3
    const options: MechanicsOption[] = [];
    for (let i = 1; i <= 3; i++) {
      const optText = cell(mechRow, `text${i}`);
      if (!optText) break; // text3 is optional — sequential presence already validated
      const optImage = cell(mechRow, `image${i}`) ?? '';
      const isAns = optText.replace(/\s+/g, ' ').trim().toLowerCase() === correctText;
      options.push({ text: optText, audio_url: '', image_url: optImage, isAns });
    }

    const mechEntry: MechanicsEntry = {
      mechanics_id: 'M3_L',
      language:     lang,
      image_url:    cell(mechRow, 'correct image') ?? '',
      options,
    };

    const payload: Payload = {
      contentId:         id,
      collectionId:      wizard.collectionId,
      name:              '',       // overridden by processor with xlsx filename
      contentType:       contType,
      contentSourceData: [sourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      status:            'live',   // static per spec
      publisher:         'ekstep', // static per spec
      language:          lang,
      contentIndex:      rowIdx,
      tags,
      mechanics_data:    [mechEntry],
    };

    payload.imagePath = cell(readAlongRow, 'image') ?? '';

    if (ml && Object.keys(ml).length > 0) payload.multilingual = ml;

    return payload;
  }

  // ── C.10  M4-M6 Mechanics (3 tabs: Read Along + Fill in the Blanks + MCQ) ──
  //         mechanic_3 is auto-generated from contentSourceData[0].text
  //
  // Read Along tab: contentType | language | text | audio_file | tags | image
  //   + multilingual_id (comma-sep) for English only — Two-Pass DB lookup
  //
  // Fill in the Blanks tab → mechanic_1 (optional; blank row = skipped):
  //   complete text (TTS source, not stored) | audio (custom audio; '' → TTS)
  //   text with blank | image | correct option | option1 | option2 | option3
  //   + time_limit (optional; default 90)
  //
  // MCQ tab → mechanic_2 (optional; blank row = skipped):
  //   question text | question audio | image | correct text | correct audio
  //   option1 | audio1 | option2 | audio2 | option3 | audio3
  //   + time_limit (optional; default 90)
  //
  // mechanic_3: always auto-generated; jumbled_text = shuffled words of source text;
  //   audio_url = ${contentId}.wav; _ttsText = source text (used by processSecondaryAudio)
  //
  // Static fields: status='live', publisher='ekstep', name=xlsx filename (set by processor)

  // Stop-word set used by extractKeywords — English only; Indic words never match,
  // so all Indic tokens are treated as content words automatically.
  private static readonly STOP_WORDS = new Set([
    'a','an','the','and','or','but','is','are','was','were','it','its',
    'to','of','in','on','that','this','with','for','as','by','at','they',
    'he','she','some',
  ]);

  /**
   * Extracts up to `maxKeywords` content words from `text` for correctness["50%"].
   * Logic mirrors the Python script provided in the spec:
   *   1. Tokenise with \p{L}+ (Unicode letters — works for English and Indic scripts)
   *   2. If token count ≤ maxKeywords, return all tokens
   *   3. Filter out English stop words; if too few remain, fall back to original list
   *   4. Sort by length descending (longest = most specific), take top maxKeywords
   */
  private extractKeywords(text: string, maxKeywords = 2): string[] {
    const words: string[] = text.match(/\p{L}+/gu) ?? [];
    if (words.length <= maxKeywords) return words;

    let content = words.filter((w) => !BulkIngestService.STOP_WORDS.has(w.toLowerCase()));
    if (content.length < maxKeywords) content = words;

    content.sort((a, b) => b.length - a.length);
    return content.slice(0, maxKeywords);
  }

  /** Fisher-Yates shuffle of whitespace-separated words in text. */
  private shuffleWords(text: string): string {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return text;
    return shuffleArray(words).join(' ');
  }

  private async buildM4M6Mechanics(
    readAlongRow: RawRow,
    fillInBlanksRow: RawRow | undefined,
    mcqRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    return this.buildM4M9MechanicsInternal(readAlongRow, fillInBlanksRow, mcqRow, wizard, rowIdx, contentId);
  }

  // ── C.11  M7-M9 Mechanics — identical structure to M4-M6 ─────────────────

  private async buildM7M9Mechanics(
    readAlongRow: RawRow,
    fillInBlanksRow: RawRow | undefined,
    mcqRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    return this.buildM4M9MechanicsInternal(readAlongRow, fillInBlanksRow, mcqRow, wizard, rowIdx, contentId);
  }

  /**
   * Shared builder for M4-M6 and M7-M9 Mechanics.
   * Produces mechanic_1 (fill_in_blank), mechanic_2 (mcq), and mechanic_3 (auto).
   */
  private async buildM4M9MechanicsInternal(
    readAlongRow: RawRow,
    fillInBlanksRow: RawRow | undefined,
    mcqRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    const id   = contentId ?? uuidv4();
    const lang = normalizeLanguage(cell(readAlongRow, 'language') ?? wizard.language);

    const rawType  = cell(readAlongRow, 'contenttype') ?? 'Sentence';
    const contType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const text = cell(readAlongRow, 'text');
    if (!text) throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);

    const tags = cellList(readAlongRow, 'tags');
    if (tags.length === 0) throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);

    const sourceEntry: Record<string, any> = { language: lang, text, audioUrl: `${id}.wav` };

    // multilingual_id: compulsory for English — at least one word, Two-Pass DB validation
    if (lang === 'en') {
      const mlWords = cellList(readAlongRow, 'multilingual_id');
      if (mlWords.length === 0) {
        throw new IngestionError(
          `Row ${rowIdx}: 'multilingual_id' is required for English content — ` +
          `provide at least one word from the text that exists in the multilingual collection`,
        );
      }
      const validated = await this.validateMultilingualWords(mlWords, rowIdx);
      sourceEntry.multilingual_id = validated;
    }

    const mechanicsData: MechanicsEntry[] = [];

    // ── mechanic_1: fill_in_blank tab ────────────────────────────────────────
    if (fillInBlanksRow) {
      const completeText  = cell(fillInBlanksRow, 'complete text'); // TTS source — NOT stored
      const customAudio   = cell(fillInBlanksRow, 'audio');         // preprocessed by preprocessRowAssets
      const textWithBlank = cell(fillInBlanksRow, 'text with blank') ?? '';
      const correctNorm   = (cell(fillInBlanksRow, 'correct option') ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

      const options: MechanicsOption[] = [];
      for (let i = 1; i <= 3; i++) {
        const optText = cell(fillInBlanksRow, `option${i}`);
        if (!optText) continue;
        options.push({
          text:      optText,
          audio_url: '',
          image_url: '',
          isAns:     optText.replace(/\s+/g, ' ').trim().toLowerCase() === correctNorm,
        });
      }

      // audio_url: use preprocessed custom file if provided, otherwise UUID for TTS
      const mechAudio = customAudio ?? `${uuidv4()}.wav`;
      const mech1: MechanicsEntry = {
        mechanics_id: 'mechanic_1',
        language:     lang,
        text:         textWithBlank,
        audio_url:    mechAudio,
        image_url:    cell(fillInBlanksRow, 'image') ?? '',
        options,
        time_limit:   90,
      };
      // _ttsText: TTS is generated from completeText (NOT textWithBlank which contains ----)
      // Only set when no custom audio file was provided
      if (!customAudio && completeText) mech1._ttsText = completeText;

      mechanicsData.push(mech1);
    }

    // ── mechanic_2: mcq tab ──────────────────────────────────────────────────
    if (mcqRow) {
      const questionText  = cell(mcqRow, 'question text') ?? '';
      const questionAudio = cell(mcqRow, 'question audio'); // preprocessed by preprocessRowAssets
      const correctNorm   = (cell(mcqRow, 'correct text') ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      const correctAudio  = cell(mcqRow, 'correct audio') ?? ''; // stored as hints.audio_url

      const options: MechanicsOption[] = [];
      for (let i = 1; i <= 3; i++) {
        const optText  = cell(mcqRow, `option${i}`);
        if (!optText) continue;
        const optAudio = cell(mcqRow, `audio${i}`);
        options.push({
          text:      optText,
          audio_url: optAudio ?? `${uuidv4()}.wav`, // TTS if no file provided
          image_url: '',
          isAns:     optText.replace(/\s+/g, ' ').trim().toLowerCase() === correctNorm,
        });
      }

      const correctOpt = options.find((o) => o.isAns);
      const mechAudio = questionAudio ?? `${uuidv4()}.wav`;
      const mech2: MechanicsEntry = {
        mechanics_id: 'mechanic_2',
        language:     lang,
        text:         questionText,
        audio_url:    mechAudio,
        image_url:    cell(mcqRow, 'image') ?? '',
        options,
        correctness:  { '50%': correctOpt ? this.extractKeywords(correctOpt.text) : [] },
        hints:        { text: '', audio_url: correctAudio, image_url: '' },
        time_limit:   90,
      };
      // _ttsText: TTS from question text when no custom audio file provided
      if (!questionAudio && questionText) mech2._ttsText = questionText;

      mechanicsData.push(mech2);
    }

    // ── mechanic_3: always auto-generated from contentSourceData text ─────────
    // audio_url = ${id}.wav (same filename as primary content audio but stored in
    // mechanics_audios/ — processSecondaryAudio uses _ttsText to synthesize TTS there)
    const mech3: MechanicsEntry = {
      mechanics_id: 'mechanic_3',
      language:     lang,
      jumbled_text: this.shuffleWords(text),
      audio_url:    `${id}.wav`,
      image_url:    '',
      _ttsText:     text,
    };
    mechanicsData.push(mech3);

    const payload: Payload = {
      contentId:         id,
      collectionId:      wizard.collectionId,
      name:              '',       // overridden by processor with xlsx filename
      contentType:       contType,
      contentSourceData: [sourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      status:            'live',   // static per spec
      publisher:         'ekstep', // static per spec
      language:          lang,
      contentIndex:      rowIdx,
      tags,
      mechanics_data:    mechanicsData,
    };

    payload.imagePath = cell(readAlongRow, 'image') ?? '';

    return payload;
  }

  // ── C.12  M10-M15 Mechanics (2 tabs: Read Along + Mechanic) ────────────────
  //
  // Read Along tab columns (same as M4-M9 Mechanics):
  //   contentType | language | text | audio_file | tags | multilingual_id (EN only)
  //
  // Mechanic tab columns:
  //   mechanics_id  — compulsory; user-supplied (e.g. 'mechanic_14')
  //   content_body  — compulsory; user-supplied pre-stringified JSON
  //                   must parse as valid JSON with a non-empty data.tasks array
  //
  // Static fields: status='live', publisher='ekstep', name=xlsx filename (set by processor)
  // language global — taken from contentSourceData (same as read-along language)

  private async buildM10M15Mechanics(
    readAlongRow: RawRow, mechRow: RawRow | undefined,
    wizard: WizardConfig, rowIdx: number, contentId?: string,
  ): Promise<Payload> {
    if (!mechRow) {
      throw new IngestionError(`Row ${rowIdx}: Mechanic tab row is required for M10-M15 Mechanics`);
    }

    const id   = contentId ?? uuidv4();
    const lang = normalizeLanguage(cell(readAlongRow, 'language') ?? wizard.language);

    const rawType  = cell(readAlongRow, 'contenttype') ?? 'Sentence';
    const contType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const text = cell(readAlongRow, 'text');
    if (!text) throw new IngestionError(`Row ${rowIdx}: 'text' column is required`);

    // Regex check: language and text script must match
    validateUnicode(lang, text, rowIdx);

    const tags = cellList(readAlongRow, 'tags');
    if (tags.length === 0) throw new IngestionError(`Row ${rowIdx}: 'tags' column is required`);

    // audioUrl is always ${contentId}.wav — actual upload handled by processMainContentAudio
    const sourceEntry: Record<string, any> = { language: lang, text, audioUrl: `${id}.wav` };

    // multilingual_id: compulsory for English, ignored for Indic — Two-Pass DB validation
    if (lang === 'en') {
      const mlWords = cellList(readAlongRow, 'multilingual_id');
      if (mlWords.length === 0) {
        throw new IngestionError(
          `Row ${rowIdx}: 'multilingual_id' is required for English content — ` +
          `provide at least one word from the text that exists in the multilingual collection`,
        );
      }
      const validated = await this.validateMultilingualWords(mlWords, rowIdx);
      sourceEntry.multilingual_id = validated;
    }

    // ── Mechanic tab ──────────────────────────────────────────────────────────
    const mechanicsId = cell(mechRow, 'mechanics_id');
    const contentBody = cell(mechRow, 'content_body');

    if (!mechanicsId) {
      throw new IngestionError(`Row ${rowIdx}: 'mechanics_id' is required in the mechanic tab`);
    }
    if (!contentBody) {
      throw new IngestionError(`Row ${rowIdx}: 'content_body' is required in the mechanic tab`);
    }

    // Validate content_body is valid JSON with the expected structure.
    // Excel cells store the value with backslash-escaped quotes (e.g. {\"key\": \"val\"}),
    // so unescape \" → " before parsing.
    const unescapedBody = contentBody.replace(/\\"/g, '"');
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(unescapedBody);
    } catch {
      throw new IngestionError(
        `Row ${rowIdx}: 'content_body' must be valid stringified JSON`,
      );
    }
    if (
      !parsedBody?.data?.tasks ||
      !Array.isArray(parsedBody.data.tasks) ||
      parsedBody.data.tasks.length === 0
    ) {
      throw new IngestionError(
        `Row ${rowIdx}: 'content_body' JSON must contain a non-empty 'data.tasks' array`,
      );
    }

    const payload: Payload = {
      contentId:         id,
      collectionId:      wizard.collectionId,
      name:              '',  // overridden by processSingleRow with xlsx filename
      contentType:       contType,
      contentSourceData: [sourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      status:            'live',
      publisher:         wizard.publisher ?? 'ekstep',
      language:          lang,
      contentIndex:      rowIdx,
      tags,
    };

    payload.mechanics_data = [{
      mechanics_id: mechanicsId,
      language:     lang,
      content_body: JSON.stringify(parsedBody),
    }];

    return payload;
  }
}
