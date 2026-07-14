/**
 * SingleContentAssetService — orchestrates synchronous creation of a single
 * content item via the UI (template-based form with file uploads).
 *
 * Mirrors the payload structures produced by BulkIngestService builders but
 * accepts in-memory file buffers instead of Excel rows / ZIP archives.
 * Supports the 5 Read Along templates in Phase 1.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { AssetPipelineService } from './asset-pipeline.service';
import { contentService } from './content.service';
import { IngestionError, normalizeLanguage, SUPPORTED_LANGUAGES } from './bulk-ingest.service';
import { multilingual } from 'src/schemas/multilingual.schema';

export type ReadAlongTemplateType =
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
  | 'M10 to M15 Mechanics Content';

const MECHANICS_TEMPLATES = new Set<string>([
  'M1 Mechanics Content',
  'M2 Mechanics Content',
  'M3 Mechanics Content',
  'M4 to M6 Mechanics Content',
  'M7 to M9 Mechanics Content',
  'M10 to M15 Mechanics Content',
]);

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

// ─── Unicode / script validation (mirrors BulkIngestService) ────────────────

const INDIC_REGEX = /[\u0900-\u0DFF\u1C80-\u1CFF\uA830-\uA83F]/;

const SCRIPT_REGEX: Readonly<Record<string, RegExp>> = {
  hi: /[\u0900-\u097F]/,
  ma: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  kn: /[\u0C80-\u0CFF]/,
  gu: /[\u0A80-\u0AFF]/,
};

function validateUnicode(lang: string, text: string): void {
  if (lang === 'en' && INDIC_REGEX.test(text)) {
    throw new IngestionError(`language is 'en' but text contains Indic characters`);
  }
  if (lang !== 'en' && !INDIC_REGEX.test(text)) {
    throw new IngestionError(`language is '${lang}' but text contains no Indic characters`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SingleContentAssetService {
  private readonly logger = new Logger(SingleContentAssetService.name);

  constructor(
    private readonly assetPipeline: AssetPipelineService,
    private readonly contentSvc: contentService,
    @InjectModel(multilingual.name) private readonly multilingualModel: Model<any>,
  ) {}

  /**
   * Create a single content item from template form fields + uploaded files.
   * Returns the saved content document.
   */
  async createContentWithAssets(
    templateType: ReadAlongTemplateType,
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
    authToken: string,
  ): Promise<any> {
    const contentId = uuidv4();
    const lang      = normalizeLanguage(fields.language ?? 'en');
    const text      = (fields.text ?? '').trim();

    if (!text) throw new IngestionError("Field 'text' is required");

    // ── 0. Unicode / script validation ───────────────────────────────────────
    validateUnicode(lang, text);

    // ── 1. Process main audio ────────────────────────────────────────────────
    const audioS3Key = `all-audio-files/${lang}/${contentId}.wav`;
    if (files.audio_file) {
      const ext = this.extFromMime(files.audio_file.mimetype, files.audio_file.originalname);
      await this.assetPipeline.convertAndUploadAudio(files.audio_file.buffer, audioS3Key, ext);
    } else {
      this.logger.log(`No audio_file uploaded for ${contentId} — generating TTS (lang=${lang})`);
      await this.assetPipeline.synthesizeAndUploadTTS(text, lang, audioS3Key);
    }
    const audioFilename = `${contentId}.wav`;

    // ── 2. Process main image ────────────────────────────────────────────────
    let imagePath = '';
    const isImageRequired = templateType === 'Textbook image mechanic';
    if (files.image) {
      imagePath = await this.assetPipeline.processAndUploadImage(
        files.image.buffer, 'mechanics_images',
      );
    } else if (isImageRequired) {
      throw new IngestionError("Field 'image' is required for Textbook image mechanic");
    }

    // ── 3. Process instruction audio (M1-M2 & M3 only) ──────────────────────
    let instAudioFilename: string | undefined;
    if (files.instruction_audio_file) {
      const instId  = uuidv4();
      const instKey = `all-audio-files/${lang}/${instId}.wav`;
      const ext = this.extFromMime(
        files.instruction_audio_file.mimetype,
        files.instruction_audio_file.originalname,
      );
      await this.assetPipeline.convertAndUploadAudio(
        files.instruction_audio_file.buffer, instKey, ext,
      );
      instAudioFilename = `${instId}.wav`;
    }

    // ── 4. Build contentSourceData entry ────────────────────────────────────
    const sourceEntry: Record<string, any> = {
      language: lang,
      text,
      audioUrl: audioFilename,
    };
    if (instAudioFilename) sourceEntry.inst_audioUrl = instAudioFilename;

    // ── 5. Handle multilingual inline (M1-M3 Read Along & M1-M3 Mechanics, English only) ─
    let multilingualMap: Record<string, { text: string; audio_url: string }> | undefined;
    const isInlineML = (
      lang === 'en' &&
      (templateType === 'M1 to M2 Read Along Content' ||
       templateType === 'M3 Read Along Content' ||
       templateType === 'M1 Mechanics Content' ||
       templateType === 'M2 Mechanics Content' ||
       templateType === 'M3 Mechanics Content')
    );
    if (isInlineML) {
      multilingualMap = await this.processInlineMultilingual(fields, files);
    }

    // ── 6. Handle multilingual_words (M4-M9/Textbook/M10-M15, English only) ─
    if (
      lang === 'en' &&
      (templateType === 'M4 to M6 Read Along Content' ||
       templateType === 'M7 to M9 Read Along Content' ||
       templateType === 'Textbook image mechanic' ||
       templateType === 'M4 to M6 Mechanics Content' ||
       templateType === 'M7 to M9 Mechanics Content' ||
       templateType === 'M10 to M15 Mechanics Content')
    ) {
      const rawWords = (fields.multilingual_words ?? '').trim();
      const words    = rawWords.split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);
      if (words.length === 0) {
        throw new IngestionError("Field 'multilingual_words' must contain at least one word");
      }
      const validated = await this.validateMultilingualWords(words);
      sourceEntry.multilingual_id = validated;
    }

    // ── 6b. Build mechanics_data (mechanics templates only) ──────────────────
    let mechanicsData: any[] | undefined;
    if (MECHANICS_TEMPLATES.has(templateType)) {
      mechanicsData = await this.buildMechanicsData(templateType, fields, files, lang, contentId, text);
    }

    // ── 7. Assemble content document ─────────────────────────────────────────
    const tags = (fields.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) throw new IngestionError("Field 'tags' is required");

    const rawType   = (fields.contentType ?? 'Word').trim();
    const contentType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

    const contentDoc: Record<string, any> = {
      contentId,
      name:              (fields.name ?? '').trim(),
      contentType,
      language:          lang,
      status:            fields.status ?? 'live',
      publisher:         fields.publisher ?? 'ekstep',
      tags,
      contentSourceData: [sourceEntry],
      level_complexity:  { level: '', level_competency: '' },
      imagePath,
    };

    if (fields.collectionId?.trim()) contentDoc.collectionId = fields.collectionId.trim();
    if (multilingualMap && Object.keys(multilingualMap).length > 0) {
      contentDoc.multilingual = multilingualMap;
    }
    if (mechanicsData && mechanicsData.length > 0) {
      contentDoc.mechanics_data = mechanicsData;
    }

    // ── 8. Enrich (phonemes, complexity) and save ────────────────────────────
    contentDoc.contentSourceData = await this.contentSvc.enrichContentSourceData(
      contentDoc.contentSourceData,
      lang,
      authToken,
    );

    return this.contentSvc.create(contentDoc as any);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * For M1-M2 & M3 Read Along (English): process per-language text/audio fields.
   * Form fields named `multilingual_{langCode}_text` / `multilingual_{langCode}_audio_file`.
   * File uploads named `multilingual_{langCode}_audio_file`.
   */
  private async processInlineMultilingual(
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
  ): Promise<Record<string, { text: string; audio_url: string }>> {
    const ml: Record<string, { text: string; audio_url: string }> = {};

    for (const langCode of SUPPORTED_LANGUAGES) {
      if (langCode === 'en') continue; // skip primary language
      const mlText = (fields[`multilingual_${langCode}_text`] ?? '').trim();
      if (!mlText) continue;

      // Validate script matches the target language
      const scriptRx = SCRIPT_REGEX[langCode];
      if (scriptRx && !scriptRx.test(mlText)) {
        throw new IngestionError(
          `Multilingual '${langCode}' text does not appear to use the correct script`,
        );
      }

      let audioFilename: string;
      const fileKey = `multilingual_${langCode}_audio_file`;
      if (files[fileKey]) {
        const mlId  = uuidv4();
        const mlKey = `multilingual_audios/${mlId}.wav`;
        const ext   = this.extFromMime(files[fileKey].mimetype, files[fileKey].originalname);
        await this.assetPipeline.convertAndUploadAudio(files[fileKey].buffer, mlKey, ext);
        audioFilename = `${mlId}.wav`;
      } else {
        // TTS in the target language
        const mlId  = uuidv4();
        const mlKey = `multilingual_audios/${mlId}.wav`;
        await this.assetPipeline.synthesizeAndUploadTTS(mlText, langCode, mlKey);
        audioFilename = `${mlId}.wav`;
      }

      ml[langCode] = { text: mlText, audio_url: audioFilename };
    }

    return ml;
  }

  /**
   * Validate multilingual_words against the multilingual collection (same logic
   * as BulkIngestService.validateMultilingualWords).
   */
  private async validateMultilingualWords(words: string[]): Promise<string[]> {
    const lowerWords = words.map((w) => w.toLowerCase());
    const docs = await this.multilingualModel
      .find({ multilingual_id: { $in: lowerWords } })
      .lean();

    const foundIds = new Set((docs as any[]).map((d) => d.multilingual_id?.toLowerCase()));
    const missing  = words.filter((w) => !foundIds.has(w.toLowerCase()));

    if (missing.length > 0) {
      throw new IngestionError(
        `Word(s) not found in multilingual collection: [${missing.join(', ')}]. ` +
        `Add translations first via the Multilingual tab.`,
      );
    }
    return words;
  }

  /** Determine file extension from mimetype or original filename. */
  private extFromMime(mimetype: string, originalname: string): string {
    if (mimetype.includes('wav'))  return '.wav';
    if (mimetype.includes('ogg'))  return '.ogg';
    if (mimetype.includes('webm')) return '.webm';
    if (mimetype.includes('mp4'))  return '.mp4';
    const dotExt = originalname.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    return dotExt ?? '.mp3';
  }

  // ── Mechanics builders ───────────────────────────────────────────────────────

  private async buildMechanicsData(
    templateType: string,
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
    lang: string,
    contentId: string,
    text: string,
  ): Promise<any[]> {
    switch (templateType) {
      case 'M1 Mechanics Content':
        return this.buildM1MechanicsData(fields, files, lang);
      case 'M2 Mechanics Content':
        return this.buildM2MechanicsData(fields, files, lang);
      case 'M3 Mechanics Content':
        return this.buildM3MechanicsData(fields, files, lang);
      case 'M4 to M6 Mechanics Content':
      case 'M7 to M9 Mechanics Content':
        return this.buildM4M9MechanicsData(fields, files, lang, contentId, text);
      case 'M10 to M15 Mechanics Content':
        return this.buildM10M15MechanicsData(fields, lang);
      default:
        return [];
    }
  }

  /** M1: mechanic image (required) + up to 3 sequential syllables with audio. */
  private async buildM1MechanicsData(
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
    lang: string,
  ): Promise<any[]> {
    if (!files.mech_image) {
      throw new IngestionError("Mechanic image is required for M1 Mechanics Content");
    }
    const mechImgPath = await this.assetPipeline.processAndUploadImage(
      files.mech_image.buffer, 'mechanics_images',
    );

    const syllable: { text: string; audio_url: string }[] = [];
    for (let i = 1; i <= 3; i++) {
      const syllText = (fields[`syllable_${i}_text`] ?? '').trim();
      if (!syllText) break; // sequential — stop at first gap
      const syllId  = uuidv4();
      const syllKey = `mechanics_audios/${syllId}.wav`;
      const audioFile = files[`mech_syllable_${i}_audio`];
      if (audioFile) {
        const ext = this.extFromMime(audioFile.mimetype, audioFile.originalname);
        await this.assetPipeline.convertAndUploadAudio(audioFile.buffer, syllKey, ext);
      } else {
        await this.assetPipeline.synthesizeAndUploadTTS(syllText, lang, syllKey);
      }
      syllable.push({ text: syllText, audio_url: `${syllId}.wav` });
    }

    if (syllable.length === 0) {
      throw new IngestionError("At least one syllable text is required for M1 Mechanics Content");
    }

    return [{ mechanics_id: 'M1_L', language: lang, image_url: mechImgPath, syllable }];
  }

  /** M2: 5 words, each with a required image and optional audio. Generates shuffled word parts. */
  private async buildM2MechanicsData(
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
    lang: string,
  ): Promise<any[]> {
    const usedParts = new Set<string>();
    const wordParts: string[] = [];
    const imageAudioMap: any[] = [];

    for (let i = 1; i <= 5; i++) {
      const wordText = (fields[`mech_word_${i}`] ?? '').trim();
      if (!wordText) throw new IngestionError(`mech_word_${i} is required`);
      if (!files[`mech_image_${i}`]) throw new IngestionError(`mech_image_${i} is required`);

      const [p1, p2] = this.splitWordUnique(wordText, usedParts);
      wordParts.push(p1, p2);

      const imgPath = await this.assetPipeline.processAndUploadImage(
        files[`mech_image_${i}`].buffer, 'mechanics_images',
      );

      const audioId  = uuidv4();
      const audioKey = `mechanics_audios/${audioId}.wav`;
      const audioFile = files[`mech_audio_${i}`];
      if (audioFile) {
        const ext = this.extFromMime(audioFile.mimetype, audioFile.originalname);
        await this.assetPipeline.convertAndUploadAudio(audioFile.buffer, audioKey, ext);
      } else {
        await this.assetPipeline.synthesizeAndUploadTTS(wordText, lang, audioKey);
      }

      imageAudioMap.push({
        text:             wordText,
        audio_url:        `${audioId}.wav`,
        image_url:        imgPath,
        multilingual_id:  wordText,
      });
    }

    return [{
      mechanics_id: 'M2_L',
      language:     lang,
      image_url:    '',
      imageAudioMap,
      words:        this.shuffleArray([...wordParts]),
    }];
  }

  /** M3: correct text/image + 2–3 option pairs; isAns set by text match. */
  private async buildM3MechanicsData(
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
    lang: string,
  ): Promise<any[]> {
    if (!files.mech_correct_image) {
      throw new IngestionError("Correct image is required for M3 Mechanics Content");
    }
    const correctImgPath = await this.assetPipeline.processAndUploadImage(
      files.mech_correct_image.buffer, 'mechanics_images',
    );

    const correctText = (fields.mech_correct_text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!correctText) throw new IngestionError("'mech_correct_text' is required");

    const options: any[] = [];
    for (let i = 1; i <= 3; i++) {
      const optText = (fields[`mech_option_${i}_text`] ?? '').trim();
      const optFile = files[`mech_option_${i}_image`];
      if (!optText || !optFile) break; // option 3 is optional; stop at first missing pair
      const imgPath = await this.assetPipeline.processAndUploadImage(optFile.buffer, 'mechanics_images');
      options.push({
        text:      optText,
        audio_url: '',
        image_url: imgPath,
        isAns:     optText.toLowerCase().replace(/\s+/g, ' ') === correctText,
      });
    }

    return [{ mechanics_id: 'M3_L', language: lang, image_url: correctImgPath, options }];
  }

  /** Shared builder for M4-M6 and M7-M9 Mechanics (mechanic_1 fill, mechanic_2 MCQ, mechanic_3 auto). */
  private async buildM4M9MechanicsData(
    fields: Record<string, string>,
    files: Record<string, UploadedFile>,
    lang: string,
    contentId: string,
    text: string,
  ): Promise<any[]> {
    const mechanicsData: any[] = [];

    // ── mechanic_1: Fill in the Blanks ──────────────────────────────────────
    const fillComplete = (fields.mech_fill_complete ?? '').trim();
    const fillText     = (fields.mech_fill_text ?? '').trim();
    if (fillComplete && fillText) {
      if (!files.mech_fill_image) throw new IngestionError("'mech_fill_image' is required when Fill in the Blanks is provided");

      const fillImgPath = await this.assetPipeline.processAndUploadImage(
        files.mech_fill_image.buffer, 'mechanics_images',
      );

      const fillAudioId  = uuidv4();
      const fillAudioKey = `mechanics_audios/${fillAudioId}.wav`;
      if (files.mech_fill_audio) {
        const ext = this.extFromMime(files.mech_fill_audio.mimetype, files.mech_fill_audio.originalname);
        await this.assetPipeline.convertAndUploadAudio(files.mech_fill_audio.buffer, fillAudioKey, ext);
      } else {
        await this.assetPipeline.synthesizeAndUploadTTS(fillComplete, lang, fillAudioKey);
      }

      const fillCorrect = (fields.mech_fill_correct ?? '').trim().toLowerCase();
      const fillOpts: any[] = [];
      for (const key of ['mech_fill_option_1', 'mech_fill_option_2', 'mech_fill_option_3']) {
        const optText = (fields[key] ?? '').trim();
        if (!optText) continue;
        fillOpts.push({ text: optText, audio_url: '', image_url: '', isAns: optText.toLowerCase() === fillCorrect });
      }

      mechanicsData.push({
        mechanics_id: 'mechanic_1',
        language:     lang,
        text:         fillText,
        audio_url:    `${fillAudioId}.wav`,
        image_url:    fillImgPath,
        options:      fillOpts,
        time_limit:   parseInt(fields.mech_fill_time || '90', 10) || 90,
      });
    }

    // ── mechanic_2: MCQ ──────────────────────────────────────────────────────
    const mcqQuestion = (fields.mech_mcq_question ?? '').trim();
    if (mcqQuestion) {
      if (!files.mech_mcq_image) throw new IngestionError("'mech_mcq_image' is required when MCQ is provided");

      const mcqImgPath = await this.assetPipeline.processAndUploadImage(
        files.mech_mcq_image.buffer, 'mechanics_images',
      );

      const mcqAudioId  = uuidv4();
      const mcqAudioKey = `mechanics_audios/${mcqAudioId}.wav`;
      if (files.mech_mcq_audio) {
        const ext = this.extFromMime(files.mech_mcq_audio.mimetype, files.mech_mcq_audio.originalname);
        await this.assetPipeline.convertAndUploadAudio(files.mech_mcq_audio.buffer, mcqAudioKey, ext);
      } else {
        await this.assetPipeline.synthesizeAndUploadTTS(mcqQuestion, lang, mcqAudioKey);
      }

      let mcqCorrectAudio = '';
      if (files.mech_mcq_correct_audio) {
        const caId  = uuidv4();
        const caKey = `mechanics_audios/${caId}.wav`;
        const ext   = this.extFromMime(files.mech_mcq_correct_audio.mimetype, files.mech_mcq_correct_audio.originalname);
        await this.assetPipeline.convertAndUploadAudio(files.mech_mcq_correct_audio.buffer, caKey, ext);
        mcqCorrectAudio = `${caId}.wav`;
      }

      const mcqCorrect = (fields.mech_mcq_correct ?? '').trim().toLowerCase();
      const mcqOpts: any[] = [];
      for (let i = 1; i <= 3; i++) {
        const optText = (fields[`mech_mcq_option_${i}`] ?? '').trim();
        if (!optText) continue;
        const optAudioId  = uuidv4();
        const optAudioKey = `mechanics_audios/${optAudioId}.wav`;
        const optAudioFile = files[`mech_mcq_option_audio_${i}`];
        if (optAudioFile) {
          const ext = this.extFromMime(optAudioFile.mimetype, optAudioFile.originalname);
          await this.assetPipeline.convertAndUploadAudio(optAudioFile.buffer, optAudioKey, ext);
        } else {
          await this.assetPipeline.synthesizeAndUploadTTS(optText, lang, optAudioKey);
        }
        mcqOpts.push({ text: optText, audio_url: `${optAudioId}.wav`, image_url: '', isAns: optText.toLowerCase() === mcqCorrect });
      }

      const correctOpt = mcqOpts.find((o) => o.isAns);
      mechanicsData.push({
        mechanics_id: 'mechanic_2',
        language:     lang,
        text:         mcqQuestion,
        audio_url:    `${mcqAudioId}.wav`,
        image_url:    mcqImgPath,
        options:      mcqOpts,
        correctness:  { '50%': correctOpt ? this.extractKeywords(correctOpt.text) : [] },
        hints:        { text: '', audio_url: mcqCorrectAudio, image_url: '' },
        time_limit:   parseInt(fields.mech_mcq_time || '90', 10) || 90,
      });
    }

    if (mechanicsData.length === 0) {
      throw new IngestionError("At least one of Fill in the Blanks or MCQ must be provided");
    }

    // ── mechanic_3: reuse uploaded audio if provided, else TTS ──────────────
    // Mirrors bulk upload: if user uploaded audio, the same WAV goes to
    // mechanics_audios/${contentId}.wav instead of generating a separate TTS.
    const mech3AudioKey = `mechanics_audios/${contentId}.wav`;
    if (files.audio_file) {
      const ext = this.extFromMime(files.audio_file.mimetype, files.audio_file.originalname);
      await this.assetPipeline.convertAndUploadAudio(files.audio_file.buffer, mech3AudioKey, ext);
    } else {
      await this.assetPipeline.synthesizeAndUploadTTS(text, lang, mech3AudioKey);
    }
    mechanicsData.push({
      mechanics_id: 'mechanic_3',
      language:     lang,
      jumbled_text: this.shuffleWords(text),
      audio_url:    `${contentId}.wav`,
      image_url:    '',
    });

    return mechanicsData;
  }

  /** M10-M15: user-supplied mechanics_id and stringified JSON content_body. */
  private buildM10M15MechanicsData(
    fields: Record<string, string>,
    lang: string,
  ): any[] {
    const mechanicsId  = (fields.mech_mechanics_id ?? '').trim();
    const contentBody  = (fields.mech_content_body  ?? '').trim();
    if (!mechanicsId) throw new IngestionError("'mech_mechanics_id' is required");
    if (!contentBody) throw new IngestionError("'mech_content_body' is required");

    let parsed: any;
    try {
      parsed = JSON.parse(contentBody.replace(/\\"/g, '"'));
    } catch {
      throw new IngestionError("'mech_content_body' must be valid JSON");
    }
    if (!Array.isArray(parsed?.data?.tasks) || parsed.data.tasks.length === 0) {
      throw new IngestionError("'mech_content_body' JSON must contain a non-empty 'data.tasks' array");
    }

    return [{ mechanics_id: mechanicsId, language: lang, content_body: contentBody }];
  }

  // ── Shared utility methods ───────────────────────────────────────────────────

  /**
   * Splits `text` into two non-empty, unique parts (middle-outward). Mirrors
   * BulkIngestService.splitWordUnique — DO NOT change the logic.
   */
  private splitWordUnique(text: string, usedParts: Set<string>): [string, string] {
    const len = text.length;
    if (len < 2) throw new IngestionError(`Word '${text}' is too short to split (minimum 2 characters)`);
    const mid = Math.floor(len / 2);
    const positions: number[] = [];
    for (let offset = 0; offset < len; offset++) {
      if (mid + offset < len)       positions.push(mid + offset);
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
    throw new IngestionError(`Cannot split '${text}' into 2 unique parts — all splits produce duplicates`);
  }

  /** Fisher-Yates shuffle — mirrors BulkIngestService.shuffleArray. */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private shuffleWords(text: string): string {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length <= 1 ? text : this.shuffleArray(words).join(' ');
  }

  private static readonly STOP_WORDS = new Set([
    'a','an','the','and','or','but','is','are','was','were','it','its',
    'to','of','in','on','that','this','with','for','as','by','at','they',
    'he','she','some',
  ]);

  /** Extracts up to 2 content keywords — mirrors BulkIngestService.extractKeywords. */
  private extractKeywords(text: string, maxKeywords = 2): string[] {
    const words: string[] = text.match(/\p{L}+/gu) ?? [];
    if (words.length <= maxKeywords) return words;
    let content = words.filter((w) => !SingleContentAssetService.STOP_WORDS.has(w.toLowerCase()));
    if (content.length < maxKeywords) content = words;
    content.sort((a, b) => b.length - a.length);
    return content.slice(0, maxKeywords);
  }
}
