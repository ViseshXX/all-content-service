/**
 * ALL Content Service — Bulk Upload Controller (Phase 4)
 *
 * POST   /v1/content/bulk-upload            — stream ZIP to disk, validate, return 202
 * GET    /v1/content/bulk-upload/status/:id  — poll job progress
 * POST   /v1/content/bulk-upload/resume/:id  — resume a FAILED job
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/multipart';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsArray,
  IsOptional,
  ArrayNotEmpty,
} from 'class-validator';

import { JwtAuthGuard } from 'src/auth/auth.guard';
import { WizardConfig, IngestionError, TEMPLATE_CONFIGS } from 'src/services/bulk-ingest.service';
import { BulkProcessorService } from 'src/services/bulk-processor.service';
import { AuditLogService } from 'src/services/audit-log.service';

const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/bulk-uploads';

/**
 * DTO for the wizard config JSON field submitted as part of the multipart upload.
 * Class-validator decorators document constraints; manual checks in the handler
 * remain authoritative for error-message parity.
 */
export class WizardConfigDto {
  @IsString() @IsNotEmpty() @IsIn(['CREATE', 'UPDATE'])
  action: 'CREATE' | 'UPDATE';

  @IsString() @IsNotEmpty()
  templateType: string;

  @IsString() @IsNotEmpty()
  collectionId: string;

  @IsString() @IsNotEmpty()
  language: string;

  @IsArray() @ArrayNotEmpty()
  tags: string[];

  @IsString() @IsNotEmpty()
  status: string;

  @IsString()
  publisher: string;

  @IsOptional() @IsString()
  target_lang_code: string;
}

@ApiTags('content', 'Bulk Upload')
@ApiBearerAuth('access-token')
@Controller('content')
@UseGuards(JwtAuthGuard)
export class BulkUploadController {
  private readonly logger = new Logger(BulkUploadController.name);

  constructor(
    private readonly bulkProcessorService: BulkProcessorService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /v1/content/bulk-upload — stream ZIP to disk, validate, return 202
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('bulk-upload')
  @ApiOperation({
    summary: 'Bulk upload content from a ZIP bundle (async job)',
    description:
      'Streams a .zip file to disk, validates row count (max 1000) and asset references, ' +
      'creates a background job, and returns 202 Accepted with a jobId for progress polling.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'wizard'],
      properties: {
        file: { type: 'string', format: 'binary', description: '.zip bundle' },
        wizard: { type: 'string', description: 'JSON-encoded WizardConfig' },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Upload accepted for background processing' })
  @ApiResponse({ status: 400, description: 'Validation or ingestion error' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async bulkUpload(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const jobId = uuidv4();
    const zipFilename = `bulk-${jobId}.zip`;
    const zipPath = path.join(STORAGE_DIR, zipFilename);
    let wizardJson: string | null = null;
    let fileReceived = false;

    try {
      // Ensure storage directory exists
      fs.mkdirSync(STORAGE_DIR, { recursive: true });

      // ── Stream multipart to disk (OOM prevention) ──────────────────────
      const parts = request.parts();

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          // Stream directly to disk — never buffer the whole file in RAM
          const writeStream = fs.createWriteStream(zipPath);
          await pipeline(part.file, writeStream);
          fileReceived = true;
        } else if (part.type === 'field' && part.fieldname === 'wizard') {
          wizardJson = part.value as string;
        }
      }

      // ── Validate inputs ────────────────────────────────────────────────
      if (!fileReceived || !fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        reply.status(HttpStatus.BAD_REQUEST).send({
          statusCode: 400, error: 'Bad Request',
          message: 'Missing or empty "file" field. Upload a .zip bundle.',
        });
        return;
      }

      if (!wizardJson) {
        fs.unlinkSync(zipPath);
        reply.status(HttpStatus.BAD_REQUEST).send({
          statusCode: 400, error: 'Bad Request',
          message: 'Missing "wizard" field. Provide a JSON-encoded WizardConfig.',
        });
        return;
      }

      let wizard: WizardConfig;
      try {
        wizard = JSON.parse(wizardJson);
      } catch {
        fs.unlinkSync(zipPath);
        reply.status(HttpStatus.BAD_REQUEST).send({
          statusCode: 400, error: 'Bad Request',
          message: 'Invalid JSON in "wizard" field.',
        });
        return;
      }

      if (!wizard.action || !['CREATE', 'UPDATE'].includes(wizard.action)) {
        fs.unlinkSync(zipPath);
        reply.status(HttpStatus.BAD_REQUEST).send({
          statusCode: 400, error: 'Bad Request',
          message: 'wizard.action must be "CREATE" or "UPDATE".',
        });
        return;
      }

      if (!wizard.templateType || !TEMPLATE_CONFIGS[wizard.templateType]) {
        fs.unlinkSync(zipPath);
        reply.status(HttpStatus.BAD_REQUEST).send({
          statusCode: 400, error: 'Bad Request',
          message: `wizard.templateType is required and must be one of: ${Object.keys(TEMPLATE_CONFIGS).join(', ')}`,
        });
        return;
      }

      // ── Capture auth token for enrichment API calls ────────────────────
      const authToken: string = request.headers?.authorization ?? '';

      // ── Validate ZIP + row count + assets, create job ──────────────────
      const submittedBy = (request as any).user
        ? { virtualId: (request as any).user.virtual_id, username: (request as any).user.username, role: (request as any).user.role }
        : undefined;

      const { jobId: createdJobId, totalRows } =
        await this.bulkProcessorService.validateAndCreateJob(zipPath, wizard, authToken, submittedBy);

      // ── Fire background processing (fire-and-forget) ───────────────────
      this.bulkProcessorService.processJobBackground(createdJobId, authToken).catch((err) => {
        this.logger.error(`Background processing failed for ${createdJobId}: ${(err as Error).message}`);
      });

      if ((request as any).user) {
        const user = (request as any).user;
        this.auditLogService.log({
          action: 'BULK_UPLOAD',
          resource: 'bulk_upload',
          resourceId: createdJobId,
          actor: { virtualId: user.virtual_id, username: user.username, role: user.role },
          summary: `Bulk upload started: ${totalRows} row(s), template '${wizard.templateType}'`,
          ipAddress: request.ip,
        });
      }

      reply.status(HttpStatus.ACCEPTED).send({
        statusCode: 202,
        message: 'Upload accepted for background processing.',
        jobId: createdJobId,
        totalRows,
      });

    } catch (err) {
      // Cleanup ZIP on validation failure
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

      if (err instanceof IngestionError) {
        this.logger.error(`Validation failed: ${err.message}`);
        reply.status(HttpStatus.BAD_REQUEST).send({
          statusCode: 400, error: 'Ingestion Error', message: err.message,
        });
        return;
      }

      this.logger.error('Unexpected error during bulk upload', (err as Error)?.stack);
      reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        statusCode: 500, error: 'Internal Server Error',
        message: 'An unexpected error occurred during bulk upload.',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /v1/content/bulk-upload/status/:jobId — poll progress
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('bulk-upload/status/:jobId')
  @ApiOperation({ summary: 'Get bulk upload job status and progress' })
  @ApiParam({ name: 'jobId', description: 'UUID of the bulk upload job' })
  @ApiResponse({ status: 200, description: 'Job status returned' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(
    @Param('jobId') jobId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const job = await this.bulkProcessorService.getJobStatus(jobId);
    if (!job) {
      reply.status(HttpStatus.NOT_FOUND).send({
        statusCode: 404, error: 'Not Found',
        message: `Job '${jobId}' not found.`,
      });
      return;
    }

    reply.status(HttpStatus.OK).send({
      statusCode:           200,
      jobId:                job.jobId,
      status:               job.status,
      templateType:         (job.wizardConfig as any)?.templateType ?? null,
      totalRows:            job.totalRows,
      processedRows:        job.processedRows,
      failedRows:           job.failedRows,
      resumeCount:          job.resumeCount ?? 0,
      errorMessage:         job.errorMessage || null,
      failedRowDetails:     job.failedRowDetails ?? [],
      resultCollectionId:   job.resultCollectionId || null,
      resultCollectionName: job.resultCollectionName || null,
      createdAt:            job.createdAt,
      updatedAt:            job.updatedAt,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /v1/content/bulk-upload/resume/:jobId — resume a FAILED job
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('bulk-upload/resume/:jobId')
  @ApiOperation({
    summary: 'Resume a failed bulk upload job',
    description:
      'Resumes processing from the last checkpoint. Returns 409 if the job was ' +
      'updated less than 2 minutes ago (race condition prevention).',
  })
  @ApiParam({ name: 'jobId', description: 'UUID of the bulk upload job to resume' })
  @ApiResponse({ status: 202, description: 'Job resume accepted' })
  @ApiResponse({ status: 400, description: 'Job is not in FAILED state' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 409, description: 'Job was recently active — wait before resuming' })
  async resumeJob(
    @Param('jobId') jobId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.bulkProcessorService.resumeJob(jobId);

    reply.status(result.statusCode).send({
      statusCode: result.statusCode,
      message: result.message,
      ...(result.success ? { jobId } : {}),
    });
  }
}
