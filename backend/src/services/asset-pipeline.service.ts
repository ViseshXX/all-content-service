/**
 * AssetPipelineService — shared image/audio/TTS processing and S3 upload.
 *
 * Used by both BulkProcessorService (bulk upload) and SingleContentAssetService
 * (single-item creation via UI). Keeps asset logic in one place.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import sharp = require('sharp');
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (same values as BulkProcessorService)
// ─────────────────────────────────────────────────────────────────────────────

const S3_BUCKET = 'all-dev-content-service';

/**
 * Languages natively supported by gtts@0.2.1.
 * kn, te, gu, ma are NOT in this list — we call Google Translate TTS directly.
 */
export const GTTS_SUPPORTED_LANGS = new Set([
  'af','sq','ar','hy','ca','zh','zh-cn','zh-tw','zh-yue','hr','cs','da','nl',
  'en','en-au','en-uk','en-us','eo','fi','fr','de','el','ht','hi','hu','is',
  'id','it','ja','ko','la','lv','mk','no','pl','pt','pt-br','ro','ru','sr',
  'sk','es','es-es','es-us','sw','sv','ta','th','tr','vi','cy',
]);

/**
 * Maps internal language codes to Google Translate TTS codes.
 * Marathi: stored as 'ma' but Google TTS uses 'mr'.
 */
export const TTS_LANG_MAP: Readonly<Record<string, string>> = { ma: 'mr' };

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AssetPipelineService {
  private readonly logger = new Logger(AssetPipelineService.name);
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

  // ── S3 upload ───────────────────────────────────────────────────────────────

  async checkAssetExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET || S3_BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  // ── Image pipeline ──────────────────────────────────────────────────────────

  /**
   * Compress an image buffer: resize to 1024×1024 max, convert to RGBA PNG,
   * apply palette compression. Returns the compressed PNG buffer.
   */
  async processImageBuffer(buffer: Buffer): Promise<Buffer> {
    const result = await sharp(buffer)
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .png({ palette: true, quality: 80, compressionLevel: 9 })
      .toBuffer();
    this.logger.log(`Processed image to ${Math.round(result.length / 1024)} KB`);
    return result;
  }

  /**
   * Process image buffer and upload to S3. Returns the S3 filename (UUID.png).
   * Caller provides the S3 folder prefix (e.g. 'mechanics_images').
   */
  async processAndUploadImage(buffer: Buffer, s3FolderPrefix: string): Promise<string> {
    const uuid = uuidv4();
    const filename = `${uuid}.png`;
    const pngBuffer = await this.processImageBuffer(buffer);
    await this.uploadToS3(`${s3FolderPrefix}/${filename}`, pngBuffer, 'image/png');
    return filename;
  }

  // ── Audio pipeline ──────────────────────────────────────────────────────────

  /**
   * Convert an audio buffer (any format) to PCM WAV using FFmpeg.
   * Writes to a temp file, converts, returns the WAV buffer.
   */
  async convertBufferToWav(inputBuffer: Buffer, inputExt = '.mp3'): Promise<Buffer> {
    const tmpId      = uuidv4();
    const tmpInPath  = path.join(os.tmpdir(), `${tmpId}_in${inputExt}`);
    const tmpOutPath = path.join(os.tmpdir(), `${tmpId}_out.wav`);

    try {
      fs.writeFileSync(tmpInPath, inputBuffer);
      await this.convertFilesToWav(tmpInPath, tmpOutPath);
      return fs.readFileSync(tmpOutPath);
    } finally {
      if (fs.existsSync(tmpInPath))  fs.unlinkSync(tmpInPath);
      if (fs.existsSync(tmpOutPath)) fs.unlinkSync(tmpOutPath);
    }
  }

  /**
   * Convert uploaded audio buffer to WAV and upload to S3.
   * Returns the S3 filename (UUID.wav).
   */
  async convertAndUploadAudio(
    buffer: Buffer,
    s3Key: string,
    inputExt = '.mp3',
  ): Promise<void> {
    const wavBuffer = await this.convertBufferToWav(buffer, inputExt);
    await this.uploadToS3(s3Key, wavBuffer, 'audio/wav');
  }

  // ── TTS synthesis ───────────────────────────────────────────────────────────

  /**
   * Synthesize speech for `text` in `lang`, convert to WAV, and upload to S3
   * at `s3Key`. Retries up to 3 times with jitter. Same behavior as the
   * private method in BulkProcessorService.
   */
  async synthesizeAndUploadTTS(text: string, lang: string, s3Key: string): Promise<void> {
    const ttsLang    = TTS_LANG_MAP[lang] ?? lang;
    const filename   = path.basename(s3Key);
    const tmpMp3Path = path.join(os.tmpdir(), filename.replace(/\.wav$/i, `_${uuidv4()}.mp3`));
    const tmpWavPath = path.join(os.tmpdir(), filename.replace(/\.wav$/i, `_${uuidv4()}.wav`));

    try {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

          if (GTTS_SUPPORTED_LANGS.has(ttsLang)) {
            const gTTS = require('gtts');
            const tts  = new gTTS(text, ttsLang);
            await new Promise<void>((resolve, reject) =>
              tts.save(tmpMp3Path, (err: Error | null) => (err ? reject(err) : resolve())),
            );
          } else {
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

          await this.convertFilesToWav(tmpMp3Path, tmpWavPath);
          lastError = null;
          break;
        } catch (err) {
          lastError = err as Error;
          this.logger.warn(
            `TTS attempt ${attempt}/3 for s3Key=${s3Key} (lang=${lang}): ${lastError.message}`,
          );
          if (fs.existsSync(tmpMp3Path)) fs.unlinkSync(tmpMp3Path);
          if (fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
        }
      }

      if (lastError) throw lastError;
      if (!fs.existsSync(tmpWavPath)) {
        throw new Error('WAV file was not produced after TTS synthesis');
      }

      const wavBuffer = fs.readFileSync(tmpWavPath);
      await this.uploadToS3(s3Key, wavBuffer, 'audio/wav');
    } finally {
      if (fs.existsSync(tmpMp3Path)) fs.unlinkSync(tmpMp3Path);
      if (fs.existsSync(tmpWavPath)) fs.unlinkSync(tmpWavPath);
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /** FFmpeg file-path conversion (same filters as BulkProcessorService). */
  private async convertFilesToWav(inputPath: string, outputPath: string): Promise<void> {
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
}
