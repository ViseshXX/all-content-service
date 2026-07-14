import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { contentService } from '../services/content.service';
import { CollectionService } from '../services/collection.service';
import { FastifyReply } from 'fastify';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map } from 'rxjs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { AuditLogService } from 'src/services/audit-log.service';
import { AssetPipelineService } from 'src/services/asset-pipeline.service';
import { SingleContentAssetService, ReadAlongTemplateType } from 'src/services/single-content-asset.service';
import en_config from 'src/config/language/en';
import common_config from 'src/config/commonConfig';

const READ_ALONG_TEMPLATES = new Set<ReadAlongTemplateType>([
  'M1 to M2 Read Along Content',
  'M3 Read Along Content',
  'M4 to M6 Read Along Content',
  'M7 to M9 Read Along Content',
  'Textbook image mechanic',
  'M1 Mechanics Content',
  'M2 Mechanics Content',
  'M3 Mechanics Content',
  'M4 to M6 Mechanics Content',
  'M7 to M9 Mechanics Content',
  'M10 to M15 Mechanics Content',
]);

@ApiTags('content')
@ApiBearerAuth('access-token')
@Controller('content')
@UseGuards(JwtAuthGuard)
export class contentController {
  constructor(
    private readonly contentService: contentService,
    private readonly collectionService: CollectionService,
    private readonly httpService: HttpService,
    private readonly auditLogService: AuditLogService,
    private readonly singleContentAssetService: SingleContentAssetService,
    private readonly assetPipelineService: AssetPipelineService,
  ) { }

  @ApiOperation({
    summary: 'Create new content',
    description: 'Create a new content item (word, sentence, paragraph, or character) with automatic phoneme and complexity analysis based on the language',
  })
  @ApiBody({
    description: 'Content data to be created',
    schema: {
      type: 'object',
      required: ['collectionId', 'name', 'contentType', 'contentSourceData', 'language'],
      properties: {
        collectionId: {
          type: 'string',
          format: 'uuid',
          example: '3f0192af-0720-4248-b4d4-d99a9f731d4f',
          description: 'UUID of the parent collection',
        },
        name: { type: 'string', example: 'tn gr2 eng t1 ch2d', description: 'Name identifier for the content' },
        contentType: {
          type: 'string',
          enum: ['Word', 'Sentence', 'Paragraph', 'Char'],
          example: 'Sentence',
          description: 'Type of content',
        },
        contentSourceData: {
          type: 'array',
          description: 'Array of content data for different languages',
          items: {
            type: 'object',
            properties: {
              language: { type: 'string', example: 'en', description: 'Language code (en, hi, ta, kn, te, gu)' },
              audioUrl: { type: 'string', example: '', description: 'URL to audio file (optional)' },
              text: { type: 'string', example: 'Blue bird, blue bird, what do you see?', description: 'The actual text content' },
            },
          },
        },
        status: { type: 'string', enum: ['live', 'draft'], example: 'live', description: 'Publication status' },
        publisher: { type: 'string', example: 'ekstep', description: 'Publisher name' },
        language: { type: 'string', example: 'en', description: 'Primary language code' },
        contentIndex: { type: 'number', example: 1, description: 'Index position in the collection' },
        tags: { type: 'array', items: { type: 'string' }, example: [], description: 'Tags for categorization' },
        imagePath: { type: 'string', example: 'image_2.jpg', description: 'Path to associated image (optional)' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Content created successfully with computed phonemes, word count, and syllable analysis',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            collectionId: { type: 'string', format: 'uuid', example: '3f0192af-0720-4248-b4d4-d99a9f731d4f' },
            name: { type: 'string', example: 'tn gr2 eng t1 ch2d' },
            contentType: { type: 'string', example: 'Sentence' },
            imagePath: { type: 'string', example: 'image_2.jpg' },
            contentSourceData: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  language: { type: 'string', example: 'en' },
                  audioUrl: { type: 'string', example: '' },
                  text: { type: 'string', example: 'Blue bird, blue bird, what do you see?' },
                  phonemes: { type: 'array', items: { type: 'string' }, example: ['b', 'l', 'u', 'b', 'ə', 'r', 'd'] },
                  wordCount: { type: 'number', example: 8 },
                  wordFrequency: { type: 'object', example: { blue: 2, bird: 2, what: 1, do: 1, you: 1, see: 1 } },
                  syllableCount: { type: 'number', example: 28 },
                  syllableCountMap: { type: 'object', example: { blue: 4, bird: 4, what: 4, do: 2, you: 3, see: 3 } },
                },
              },
            },
            status: { type: 'string', example: 'live' },
            publisher: { type: 'string', example: 'ekstep' },
            language: { type: 'string', example: 'en' },
            contentIndex: { type: 'number', example: 1 },
            tags: { type: 'array', items: { type: 'string' }, example: [] },
            createdAt: { type: 'string', format: 'date-time', example: '2024-06-07T09:48:00.040Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2024-06-07T09:48:00.040Z' },
            _id: { type: 'string', example: '6662d7ff059b133df04db6e3' },
            contentId: { type: 'string', format: 'uuid', example: 'fa853c29-bf19-417a-9661-c67d2671ebc1' },
            __v: { type: 'number', example: 0 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Server error - error message' },
      },
    },
  })
  @Post()
  async create(@Req() request: any, @Res() response: FastifyReply, @Body() content: any) {
    try {
      const authToken: string = request.headers?.authorization ?? '';

      content.contentSourceData = await this.contentService.enrichContentSourceData(
        content.contentSourceData,
        content.language,
        authToken,
      );

      const newContent = await this.contentService.create(content);

      if (request.user) {
        this.auditLogService.log({
          action: 'CREATE',
          resource: 'content',
          resourceId: (newContent as any).contentId,
          actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
          summary: `Created content '${content.name || (newContent as any).contentId}'`,
          ipAddress: request.ip,
        });
      }

      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: newContent,
      });
    } catch (error: any) {
      const message: string = error?.message ?? String(error);
      console.error('[content.create] Failed to create content:', message);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message,
      });
    }
  }

  // ── POST /content/upload-asset ──────────────────────────────────────────────
  // Accepts multipart/form-data with a single file.
  // Processes (WAV conversion or image compression) and uploads to S3.
  // If existingFilename is provided the same S3 key is reused (overwrite).
  // Returns { filename } — the stored filename (no path prefix).

  @ApiExcludeEndpoint(true)
  @Post('upload-asset')
  async uploadAsset(@Req() request: any, @Res() response: FastifyReply): Promise<void> {
    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | undefined;
    let fileExt = '.mp3';

    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Uint8Array[] = [];
          for await (const chunk of part.file) chunks.push(chunk as Uint8Array);
          fileBuffer = Buffer.concat(chunks as any);
          fileExt = path.extname(part.filename || '.mp3') || '.mp3';
        } else if (part.type === 'field') {
          fields[part.fieldname] = part.value as string;
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        response.status(HttpStatus.BAD_REQUEST).send({ status: 'error', message: 'No file provided' });
        return;
      }

      const assetType   = (fields.assetType || 'audio') as 'audio' | 'image';
      const language    = fields.language || 'en';
      const existing    = fields.existingFilename || '';
      // audioFolder: 'multilingual_audios' for M1-M3 multilingual entries, otherwise defaults to all-audio-files/{lang}
      const audioFolder = fields.audioFolder || '';

      // Derive the base name from the existing filename, or generate a new UUID
      const baseName = existing
        ? path.basename(existing, path.extname(existing))
        : uuidv4();

      let filename: string;

      if (assetType === 'image') {
        filename = `${baseName}.png`;
        const compressed = await this.assetPipelineService.processImageBuffer(fileBuffer);
        await this.assetPipelineService.uploadToS3(`mechanics_images/${filename}`, compressed, 'image/png');
      } else {
        // audio — supports content audios (all-audio-files/{lang}/) and multilingual audios (multilingual_audios/)
        filename = `${baseName}.wav`;
        const s3Folder = audioFolder || `all-audio-files/${language}`;
        const s3Key = `${s3Folder}/${filename}`;
        await this.assetPipelineService.convertAndUploadAudio(fileBuffer, s3Key, fileExt);
      }

      response.status(HttpStatus.OK).send({ status: 'success', data: { filename } });
    } catch (error: any) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Asset processing failed: ' + error.message,
      });
    }
  }

  // ── POST /content/create-with-assets ────────────────────────────────────────
  // Accepts multipart/form-data with template form fields + uploaded files.
  // Creates a single content item synchronously with TTS fallback for audio.

  @ApiExcludeEndpoint(true)
  @Post('create-with-assets')
  async createWithAssets(@Req() request: any, @Res() response: FastifyReply): Promise<void> {
    const fields: Record<string, string> = {};
    const files:  Record<string, { buffer: Buffer; mimetype: string; originalname: string }> = {};

    try {
      // Stream multipart parts — buffer files in memory (individual files, not ZIP)
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const rawChunks: Uint8Array[] = [];
          for await (const chunk of part.file) rawChunks.push(chunk as Uint8Array);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const fileBuffer = Buffer.concat(rawChunks as any);
          files[part.fieldname] = {
            buffer:       fileBuffer,
            mimetype:     part.mimetype,
            originalname: part.filename ?? part.fieldname,
          };
        } else if (part.type === 'field') {
          fields[part.fieldname] = part.value as string;
        }
      }

      const templateType = fields.templateType as ReadAlongTemplateType;
      if (!templateType || !READ_ALONG_TEMPLATES.has(templateType)) {
        response.status(HttpStatus.BAD_REQUEST).send({
          status: 'error',
          message: `Invalid or missing templateType. Must be one of: ${[...READ_ALONG_TEMPLATES].join(', ')}`,
        });
        return;
      }

      const authToken = request.headers?.authorization ?? '';
      const newContent = await this.singleContentAssetService.createContentWithAssets(
        templateType, fields, files, authToken,
      );

      if (request.user) {
        this.auditLogService.log({
          action:     'CREATE',
          resource:   'content',
          resourceId: (newContent as any).contentId,
          actor:      { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
          summary:    `Created content '${fields.name || (newContent as any).contentId}' via template form (${templateType})`,
          ipAddress:  request.ip,
        });
      }

      response.status(HttpStatus.CREATED).send({ status: 'success', data: newContent });
    } catch (error: any) {
      const message: string = error?.message ?? String(error);
      console.error('[content.createWithAssets] Failed:', message);
      const status = message.includes('required') || message.includes('not found')
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.INTERNAL_SERVER_ERROR;
      response.status(status).send({ status: 'error', message });
    }
  }

  @ApiExcludeEndpoint(true)
  @Post('search')
  async searchContent(@Res() response: FastifyReply, @Body() tokenData: any) {
    try {
      const contentCollection = await this.contentService.search(
        tokenData.tokenArr,
        tokenData.language,
        tokenData.contentType,
        tokenData.limit,
        tokenData.tags,
        tokenData.cLevel,
        tokenData.complexityLevel,
        tokenData.graphemesMappedObj,
      );
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: contentCollection,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Post('charNotPresent')
  async charNotPresentContent(
    @Res() response: FastifyReply,
    @Body() tokenData: any,
  ) {
    try {
      const contentCollection = await this.contentService.charNotPresent(
        tokenData.tokenArr,
      );
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: contentCollection,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiOperation({
    summary: 'Get paginated content',
    description: 'Retrieve content items with pagination support, filtered by type and collection ID. Returns content data along with total syllable count.',
  })
  @ApiQuery({
    name: 'type',
    description: 'Content type to filter (Word, Sentence, Paragraph, Char)',
    required: false,
    example: 'Word',
  })
  @ApiQuery({
    name: 'collectionId',
    description: 'UUID of the collection to filter content',
    required: false,
    example: '3f0192af-0720-4248-b4d4-d99a9f731d4f',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (starts from 1)',
    required: false,
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (min: 5, max: 20)',
    required: false,
    example: 10,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated content retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '6662d7ff059b133df04db6e3' },
              contentType: { type: 'string', example: 'Sentence' },
              contentSourceData: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string', example: 'Blue bird, blue bird, what do you see?' },
                    phonemes: { type: 'array', items: { type: 'string' }, example: ['b', 'l', 'u', 'b', 'ə', 'r'] },
                    syllableCount: { type: 'number', example: 28 },
                  },
                },
              },
              language: { type: 'string', example: 'en' },
              contentId: { type: 'string', format: 'uuid', example: 'fa853c29-bf19-417a-9661-c67d2671ebc1' },
            },
          },
        },
        totalSyllableCount: { type: 'number', example: 26, description: 'Total syllable count across all returned content' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Server error - error message' },
      },
    },
  })
  @Get('/pagination')
  async pagination(
    @Res() response: FastifyReply,
    @Query('type') type,
    @Query('collectionId') collectionId,
    @Query('page') page = 1,
    @Query() { limit = 5 },
  ) {
    try {
      // Add the check for the limit
      if (limit < 5) {
        limit = 5;
      } else if (limit > 20) {
        limit = 20;
      }
      const skip = (page - 1) * limit;
      const { data } = await this.contentService.pagination(
        skip,
        limit,
        type,
        collectionId,
      );
      const language = data[0].language;

      let totalSyllableCount = 0;
      if (language === 'en') {
        data.forEach((contentObject: any) => {
          totalSyllableCount +=
            contentObject.contentSourceData[0].phonemes.length;
        });
      } else {
        data.forEach((contentObject: any) => {
          totalSyllableCount +=
            contentObject.contentSourceData[0].syllableCount;
        });
      }
      return response.status(HttpStatus.OK).send({
        status: 'success',
        data,
        totalSyllableCount: totalSyllableCount,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiOperation({
    summary: 'Get random content',
    description: 'Retrieve a random set of content items filtered by type and language. Useful for generating practice exercises.',
  })
  @ApiQuery({
    name: 'type',
    description: 'Content type to filter (Word, Sentence, Paragraph, Char)',
    required: true,
    example: 'Word',
  })
  @ApiQuery({
    name: 'language',
    description: 'Language code to filter content (en, hi, ta, kn, te, gu)',
    required: true,
    example: 'en',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of random items to retrieve',
    required: false,
    example: 5,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Random content retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '6662d7ff059b133df04db6e3' },
              collectionId: { type: 'string', format: 'uuid', example: '3f0192af-0720-4248-b4d4-d99a9f731d4f' },
              name: { type: 'string', example: 'tn gr2 eng t1 ch2d' },
              contentType: { type: 'string', example: 'Sentence' },
              imagePath: { type: 'string', example: 'image_2.jpg' },
              contentSourceData: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    language: { type: 'string', example: 'en' },
                    audioUrl: { type: 'string', example: '' },
                    text: { type: 'string', example: 'Blue bird, blue bird, what do you see?' },
                    phonemes: { type: 'array', items: { type: 'string' }, example: ['b', 'l', 'u', 'b', 'ə', 'r', 'd'] },
                    wordCount: { type: 'number', example: 8 },
                    wordFrequency: { type: 'object', example: { blue: 2, bird: 2, what: 1 } },
                    syllableCount: { type: 'number', example: 28 },
                    syllableCountMap: { type: 'object', example: { blue: 4, bird: 4 } },
                  },
                },
              },
              status: { type: 'string', example: 'live' },
              publisher: { type: 'string', example: 'ekstep' },
              language: { type: 'string', example: 'en' },
              contentIndex: { type: 'number', example: 1 },
              tags: { type: 'array', items: { type: 'string' }, example: [] },
              createdAt: { type: 'string', format: 'date-time', example: '2024-06-07T09:48:00.040Z' },
              updatedAt: { type: 'string', format: 'date-time', example: '2024-06-07T09:48:00.040Z' },
              contentId: { type: 'string', format: 'uuid', example: 'fa853c29-bf19-417a-9661-c67d2671ebc1' },
              __v: { type: 'number', example: 0 },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Server error - error message' },
      },
    },
  })
  @Get('/getRandomContent')
  async getRandomContent(
    @Res() response: FastifyReply,
    @Query('type') type,
    @Query('language') language,
    @Query() { limit = 5 },
  ) {
    try {
      const Batch: any = limit;
      const { data } = await this.contentService.getRandomContent(
        parseInt(Batch),
        type,
        language,
      );
      return response.status(HttpStatus.OK).send({ status: 'success', data });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Get('/getContentWord')
  async getContentWord(
    @Res() response: FastifyReply,
    @Query('language') language: string,
    @Query('limit') limit: any,
    @Query('multilingual') multilingual: string,
  ) {
    try {
      // Validate and parse limit parameter
      let validLimit = 5; // default
      if (limit !== undefined && limit !== null) {
        const parsedLimit = parseInt(String(limit), 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          validLimit = parsedLimit;
        }
      }
      const includeMultilingual = multilingual === 'true';

      const { data } = await this.contentService.getContentWord(
        limit,
        language,
        includeMultilingual,
      );
      
       // Ensure we don't return more than requested
      const limitedData = data.slice(0, validLimit);

      return response.status(HttpStatus.OK).send({ status: 'success', data: limitedData });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Get('/getContentSentence')
  async getContentSentence(
    @Res() response: FastifyReply,
    @Query('language') language,
    @Query() { limit = 5 },
  ) {
    try {
      const Batch: any = limit;
      const { data } = await this.contentService.getContentSentence(
        parseInt(Batch),
        language,
      );
      return response.status(HttpStatus.OK).send({ status: 'success', data });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Get('/getContentParagraph')
  async getContentParagraph(
    @Res() response: FastifyReply,
    @Query('language') language,
    @Query() { limit = 5 },
  ) {
    try {
      const Batch: any = limit;
      const { data } = await this.contentService.getContentParagraph(
        parseInt(Batch),
        language,
      );
      return response.status(HttpStatus.OK).send({ status: 'success', data });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiOperation({
    summary: 'Search and get content',
    description: 'Advanced content search with token-based filtering, complexity levels, competency levels, and grapheme mapping support. Returns matched content with syllable analysis.',
  })
  @ApiBody({
    description: 'Search parameters for content retrieval',
    required: true,
    schema: {
      type: 'object',
      properties: {
        tokenArr: {
          type: 'array',
          description: 'Array of phoneme/grapheme tokens to search for',
          items: { type: 'string' },
          example: ['c', 'v', 'n'],
        },
        language: {
          type: 'string',
          description: 'Language code (en, hi, ta, kn, te, gu)',
          example: 'en',
        },
        contentType: {
          type: 'string',
          enum: ['Word', 'Sentence', 'Paragraph', 'Char'],
          description: 'Type of content to retrieve',
          example: 'Word',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return',
          example: 5,
        },
        cLevel: {
          type: 'string',
          description: 'Content level (L1, L2, L3, etc.)',
          example: 'L2',
        },
        complexityLevel: {
          type: 'array',
          description: 'Array of complexity levels to filter (C1, C2, C3)',
          items: { type: 'string' },
          example: ['C1', 'C2'],
        },
        tags: {
          type: 'array',
          description: 'Tags to filter content',
          items: { type: 'string' },
          example: ['ASER'],
        },
        story_mode: {
          type: 'string',
          description: 'Enable story mode for competency-based filtering',
          example: 'true',
        },
        level_competency: {
          type: 'array',
          description: 'Competency levels for filtering',
          items: { type: 'string' },
          example: [],
        },
        CEFR_level: {
          type: 'string',
          description: 'CEFR proficiency level',
          example: 'A1',
        },
        mechanics_id: {
          type: 'string',
          description: 'Filter by specific mechanics ID',
          example: 'mech_001',
        },
        multilingual: {
          type: 'string',
          description: 'Include multilingual data (true/false)',
          example: 'true',
        },
        graphemesMappedObj: {
          type: 'object',
          description: 'Mapping of phonemes to grapheme representations',
          example: {
            c: ['ch'],
            v: ['v', 've'],
            w: ['w', 'wh'],
            æ: ['a', 'ai', 'au'],
            θ: ['th'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            wordsArr: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: { type: 'string', example: '660f9545367a62b3902dd58b' },
                  contentId: {
                    type: 'string',
                    example: 'f8dd7c97-53f7-4676-b597-4a52aaface5c',
                  },
                  collectionId: {
                    type: 'string',
                    example: '6a519951-8635-4d89-821a-d3eb60f6e1ec',
                  },
                  name: { type: 'string', example: 'L2_new_3' },
                  contentType: { type: 'string', example: 'Word' },
                  contentSourceData: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        language: { type: 'string', example: 'en' },
                        audioUrl: { type: 'string', example: '' },
                        text: { type: 'string', example: 'five' },
                        phonemes: {
                          type: 'array',
                          items: { type: 'string', example: 'f' },
                        },
                        wordCount: { type: 'number', example: 1 },
                        wordFrequency: {
                          type: 'object',
                          additionalProperties: { type: 'number', example: 1 },
                        },
                        syllableCount: { type: 'number', example: 4 },
                        syllableCountMap: {
                          type: 'object',
                          additionalProperties: { type: 'number', example: 4 },
                        },
                        syllableCountArray: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              k: { type: 'string', example: 'five' },
                              v: { type: 'number', example: 4 },
                            },
                          },
                        },
                      },
                    },
                  },
                  status: { type: 'string', example: 'live' },
                  publisher: { type: 'string', example: 'ekstep' },
                  language: { type: 'string', example: 'en' },
                  contentIndex: { type: 'number', example: 141 },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  createdAt: {
                    type: 'string',
                    example: '2024-04-05T05:45:55.335Z',
                  },
                  updatedAt: {
                    type: 'string',
                    example: '2024-04-05T05:45:55.335Z',
                  },
                  __v: { type: 'number', example: 0 },
                  matchedChar: {
                    type: 'array',
                    items: { type: 'string', example: 'v' },
                  },
                },
              },
            },
            contentForToken: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    _id: {
                      type: 'string',
                      example: '660f9545367a62b3902dd58b',
                    },
                    contentId: {
                      type: 'string',
                      example: 'f8dd7c97-53f7-4676-b597-4a52aaface5c',
                    },
                    collectionId: {
                      type: 'string',
                      example: '6a519951-8635-4d89-821a-d3eb60f6e1ec',
                    },
                    name: { type: 'string', example: 'L2_new_3' },
                    contentType: { type: 'string', example: 'Word' },
                    contentSourceData: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          language: { type: 'string', example: 'en' },
                          audioUrl: { type: 'string', example: '' },
                          text: { type: 'string', example: 'five' },
                          phonemes: {
                            type: 'array',
                            items: { type: 'string', example: 'f' },
                          },
                          wordCount: { type: 'number', example: 1 },
                          wordFrequency: {
                            type: 'object',
                            additionalProperties: {
                              type: 'number',
                              example: 1,
                            },
                          },
                          syllableCount: { type: 'number', example: 4 },
                          syllableCountMap: {
                            type: 'object',
                            additionalProperties: {
                              type: 'number',
                              example: 4,
                            },
                          },
                          syllableCountArray: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                k: { type: 'string', example: 'five' },
                                v: { type: 'number', example: 4 },
                              },
                            },
                          },
                        },
                      },
                    },
                    status: { type: 'string', example: 'live' },
                    publisher: { type: 'string', example: 'ekstep' },
                    language: { type: 'string', example: 'en' },
                    contentIndex: { type: 'number', example: 141 },
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    createdAt: {
                      type: 'string',
                      example: '2024-04-05T05:45:55.335Z',
                    },
                    updatedAt: {
                      type: 'string',
                      example: '2024-04-05T05:45:55.335Z',
                    },
                    __v: { type: 'number', example: 0 },
                    matchedChar: {
                      type: 'array',
                      items: { type: 'string', example: 'v' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Server error - error message' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @Post('/getContent')
  async getContent(@Res() response: FastifyReply, @Body() queryData: any) {
    try {
      const Batch: any = queryData.limit || 5;
      let contentCollection;
      let collectionId;

      const tags = queryData.language === 'en' ? en_config.tags : common_config.tags;

      if (tags.some(tag => queryData.tags.some(qtag => qtag.includes(tag)))) {
        queryData.cLevel = "";
        queryData.complexityLevel = "";
        queryData.graphemesMappedObj = {};
        queryData.level_competency = [];
        queryData.tokenArr = [];
      }

      if (
        queryData.story_mode === 'true' &&
        queryData.level_competency.length > 0
      ) {
        collectionId = await this.collectionService.getCompetencyCollections(
          queryData.level_competency,
          queryData.language,
          queryData.contentType,
          queryData.CEFR_level,
        );
        const contentData = await this.contentService.pagination(
          0,
          parseInt(Batch),
          queryData.contentType,
          collectionId,
        );
        let contentArr = contentData['data'];

        if (contentArr.length === 0) {
          await this.contentService
            .search(
              queryData.tokenArr,
              queryData.language,
              queryData.contentType,
              parseInt(Batch),
              queryData.tags,
              queryData.cLevel,
              queryData.complexityLevel,
              queryData.graphemesMappedObj,
              queryData.level_competency,
              queryData.CEFR_level,
            )
            .then((contentData) => {
              contentArr = contentData['wordsArr'];
            });
        }

        if (queryData.mechanics_id !== undefined) {
          contentArr.map((content) => {
            const { mechanics_data } = content;
            if (mechanics_data) {
              const mechanicData = mechanics_data.find((mechanic) => {
                return mechanic.mechanics_id === queryData.mechanics_id;
              });
              content.mechanics_data = [];
              content.mechanics_data.push(mechanicData);
            }
          });
        }

        contentCollection = { wordsArr: contentArr };
      }

      if (queryData.mechanics_id === undefined && collectionId === undefined) {
        const limit = parseInt(Batch.limit || Batch) || 20;
        const page  = parseInt(queryData.page)  || 1;
        const toArr = (v: any): string[] | undefined => {
          if (!v) return undefined;
          const arr = Array.isArray(v) ? v : [v];
          return arr.length ? arr : undefined;
        };
        const searchFilters: { contentId?: string[]; collectionId?: string[]; text?: string; tags?: string[] } = {};
        const sid = toArr(queryData.searchContentId);
        if (sid) searchFilters.contentId = sid;
        if (queryData.searchText) searchFilters.text = queryData.searchText;
        if (queryData.searchTags?.length) searchFilters.tags = queryData.searchTags;
        if (queryData.collectionId) {
          contentCollection = await this.contentService.findByCollection(
            queryData.collectionId,
            queryData.language,
            queryData.contentType || undefined,
            limit,
            page,
            Object.keys(searchFilters).length ? searchFilters : undefined,
          );
        } else if (queryData.page !== undefined) {
          const scid = toArr(queryData.searchCollectionId);
          if (scid) searchFilters.collectionId = scid;
          contentCollection = await this.contentService.findAllContent(
            queryData.language,
            queryData.contentType || undefined,
            limit,
            page,
            Object.keys(searchFilters).length ? searchFilters : undefined,
          );
        } else {
          contentCollection = await this.contentService.search(
            queryData.tokenArr,
            queryData.language,
            queryData.contentType,
            limit,
            queryData.tags,
            queryData.cLevel,
            queryData.complexityLevel,
            queryData.graphemesMappedObj,
            queryData.level_competency,
            queryData.CEFR_level,
          );
        }
      } else {
        contentCollection = await this.contentService.getMechanicsContentData(
          queryData.contentType,
          queryData.mechanics_id,
          parseInt(Batch.limit || Batch),
          queryData.language,
          queryData.level_competency,
          queryData.tags,
          queryData.CEFR_level,
        );
      }

      // Enhance data with multilingual information for imageAudioMap
      if (contentCollection?.wordsArr?.length > 0) {
        const enhancedWordsArr = await Promise.all(
          contentCollection.wordsArr.map(async (item) => {
            // Handle mechanics_data multilingual enhancement (existing functionality)
            if (item.mechanics_data?.length > 0) {
              for (const mechanic of item.mechanics_data) {
                if (mechanic && mechanic.imageAudioMap?.length > 0) {
                  const multilingualIds = [...new Set(
                    mechanic.imageAudioMap
                      .filter(mapItem => mapItem && mapItem.multilingual_id)
                      .map(mapItem => mapItem.multilingual_id)
                  )];

                  if (multilingualIds.length > 0) {
                    const multilingualData = await this.contentService.getMultilingualDataByIds(multilingualIds as string[]);
                    const multilingualMap = {};
                    multilingualData?.forEach(ml => {
                      if (ml && ml.multilingual_id) {
                        multilingualMap[ml.multilingual_id] = ml.multilingual;
                      }
                    });

                    mechanic.imageAudioMap = mechanic.imageAudioMap.map(mapItem => ({
                      ...mapItem,
                      multilingual_data: mapItem.multilingual_id ? 
                        multilingualMap[mapItem.multilingual_id] || null : null
                    }));
                  }
                }
              }
            }

            // Handle contentSourceData multilingual
            if ((queryData.multilingual === 'true' ||queryData.multilingual === true) && item.contentSourceData?.length > 0) {
              let multilingualData = {};
              
              // Find the contentSourceData for the requested language
              const sourceData = item.contentSourceData.find(
                (source) => source.language === queryData.language
              );
              
              if (sourceData?.multilingual_id && Array.isArray(sourceData.multilingual_id)) {
                // Fetch multilingual data for all multilingual_ids at once
                const multilingualDocs = await this.contentService.getMultilingualDataByIds(sourceData.multilingual_id);
                
                // Structure the multilingual data
                multilingualDocs?.forEach((doc) => {
                  if (doc) {
                    multilingualData[doc.multilingual_id] = doc.multilingual;
                  }
                });
              }
              
              item.multilingual_data = multilingualData;
            }

            return item;
          })
        );

        contentCollection.wordsArr = enhancedWordsArr;
      }

      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: contentCollection,
      });
    } catch (error) {
      console.log(error);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Post('/getContentByFilters')
  async getContentByFilters(
    @Res() response: FastifyReply,
    @Body() queryData: any,
  ) {
    try {
      let Batch: any = queryData.limit || 5;

      const contentCollection = await this.contentService.searchByFilter(
        queryData?.syllableList,
        queryData?.syllableCount,
        queryData?.wordCount,
        queryData?.totalOrthoComplexity,
        queryData?.totalPhonicComplexity,
        queryData?.meanPhonicComplexity,
        queryData.language,
        queryData.contentType,
        parseInt(Batch),
        queryData?.contentId,
        queryData?.collectionId,
        queryData?.tags,
      );
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: contentCollection,
      });
    } catch (error) {
      console.log(error);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiOperation({
    summary: 'Get assessment collections',
    description: 'Retrieve assessment collections filtered by tags and language. For ASER assessments, returns collections across all 5 sets.',
  })
  @ApiBody({
    description: 'Assessment filter parameters',
    required: true,
    schema: {
      type: 'object',
      required: ['tags', 'language'],
      properties: {
        tags: {
          type: 'array',
          description: 'Array of assessment tags (e.g., ASER, NAS)',
          items: { type: 'string' },
          example: ['ASER'],
        },
        language: {
          type: 'string',
          description: 'Language code (en, hi, ta, kn, te, gu)',
          example: 'ta',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Assessment collections retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '65e88b6cdee499a6209e739e' },
              name: { type: 'string', example: '(மாதிறி -4)எழுத்து' },
              category: { type: 'string', example: 'Char' },
              collectionId: { type: 'string', format: 'uuid', example: 'ed47eb63-87c8-41f4-821d-1400fef37b78' },
            },
          },
        },
        status: { type: 'number', example: 200 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Server error - error message' },
      },
    },
  })
  @Post('/getAssessment')
  async getAssessment(@Res() response: FastifyReply, @Body() queryData: any) {
    try {
      let contentCollection;

      if (queryData.tags.includes('ASER')) {
        let collectionArr = [];
        for (let setno = 1; setno <= 5; setno++) {
          let tags = [];
          tags.push(...queryData.tags);
          tags.push('set' + setno);
          let collection = await this.collectionService.getAssessment(
            tags,
            queryData.language,
          );
          if (collection.data[0] != null) {
            collectionArr.push(collection.data[0]);
          }
        }
        contentCollection = {
          data: collectionArr,
          status: 200,
        };
      } else {
        contentCollection = await this.collectionService.getAssessment(
          queryData.tags,
          queryData.language,
        );
      }

      return response.status(HttpStatus.CREATED).send(contentCollection);
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Post('/getContentForMileStone')
  async get(@Res() response: FastifyReply, @Body() queryData: any) {
    try {
      const Batch: any = queryData.limit || 5;
      const contentCollection = await this.contentService.getContentLevelData(
        queryData.cLevel,
        queryData.complexityLevel,
        queryData.language,
        parseInt(Batch),
        queryData.contentType,
      );
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        contentCollection,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @ApiExcludeEndpoint(true)
  @Get('/check-asset')
  async checkAsset(@Res() response: FastifyReply, @Query('key') key: string) {
    try {
      if (!key?.trim()) {
        return response.status(HttpStatus.BAD_REQUEST).send({ status: 'error', message: 'key is required' });
      }
      const exists = await this.assetPipelineService.checkAssetExists(key.trim());
      return response.status(HttpStatus.OK).send({ status: 'success', exists });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ status: 'error', message: 'Server error - ' + error });
    }
  }

  @ApiExcludeEndpoint(true)
  @Post('/generate-tts')
  async generateTts(@Res() response: FastifyReply, @Body() body: { text: string; language: string; filename: string; folder: string }) {
    try {
      const { text, language, filename, folder } = body;
      if (!text?.trim() || !language?.trim() || !filename?.trim() || !folder?.trim()) {
        return response.status(HttpStatus.BAD_REQUEST).send({ status: 'error', message: 'text, language, filename and folder are required' });
      }
      const baseName    = filename.trim().replace(/\.wav$/i, '');
      const wavFilename = `${baseName}.wav`;
      const s3Key       = `${folder.trim()}/${wavFilename}`;
      await this.assetPipelineService.synthesizeAndUploadTTS(text.trim(), language.trim(), s3Key);
      return response.status(HttpStatus.OK).send({ status: 'success', data: { filename: wavFilename } });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ status: 'error', message: 'TTS generation failed - ' + error });
    }
  }

  @ApiExcludeEndpoint(true)
  @Get('/tags')
  async getDistinctTags(@Res() response: FastifyReply) {
    try {
      const tags = await this.contentService.getDistinctTags();
      return response.status(HttpStatus.OK).send({ status: 'success', data: tags });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ status: 'error', message: 'Server error - ' + error });
    }
  }

  @Get()
  async fetchAll(
    @Res() response: FastifyReply,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    try {
      const limitCount = limit;
      const data = await this.contentService.readAll(page, limit);
      const dataCount: any = await this.contentService.countAll();
      const pageCount = Math.trunc(dataCount / limitCount);
      return response.status(HttpStatus.OK).send({
        status: 'success',
        recordCount: dataCount,
        pageCount: pageCount,
        data,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Get('/getByIds')
  async findByIds(@Res() response: FastifyReply, @Query('ids') ids: string) {
    try {
      const idList = ids.split(',').map(id => id.trim());

      const contents = await this.contentService.readByIds(idList);

      return response.status(HttpStatus.OK).send({
        contents,
        count: contents.length,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Error fetching content: ' + error.message,
      });
    }
  }


  @ApiExcludeEndpoint(true)
  @Put('/:id')
  async update(
    @Req() request: any,
    @Res() response: FastifyReply,
    @Param('id') id,
    @Body() content: any,
  ) {
    try {
      const lcSupportedLanguages = ['ta', 'ka', 'hi', 'te', 'kn'];

      const updatedcontentSourceData = await Promise.all(
        content.contentSourceData.map(async (contentSourceDataEle) => {
          if (lcSupportedLanguages.includes(contentSourceDataEle['language'])) {
            let contentLanguage = contentSourceDataEle['language'];

            if (contentSourceDataEle['language'] === 'kn') {
              contentLanguage = 'ka';
            }

            const url = process.env.ALL_LC_API_URL + contentLanguage;
            const textData = {
              request: {
                language_id: contentLanguage,
                text: contentSourceDataEle['text'],
              },
            };

            const newContent = await lastValueFrom(
              this.httpService
                .post(url, JSON.stringify(textData), {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                })
                .pipe(map((resp) => resp.data)),
            );

            const newWordMeasures = Object.entries(
              newContent.result.wordMeasures,
            ).map((wordMeasuresEle) => {
              const wordComplexityMatrices: any = wordMeasuresEle[1];
              return { text: wordMeasuresEle[0], ...wordComplexityMatrices };
            });

            delete newContent.result.meanWordComplexity;
            delete newContent.result.totalWordComplexity;
            delete newContent.result.wordComplexityMap;

            newContent.result.wordMeasures = newWordMeasures;

            // Calculate readingComplexity for hi/te/kn (same as enrichContentSourceData)
            const readingComplexityLang = ['hi', 'te', 'kn'];
            if (readingComplexityLang.includes(contentSourceDataEle['language']) && process.env.ALL_TEXT_EVAL_URL) {
              try {
                const rcUrl = process.env.ALL_TEXT_EVAL_URL + 'getReadingComplexity';
                const rcResponse = await lastValueFrom(
                  this.httpService
                    .post(rcUrl, { language: contentSourceDataEle['language'], text: contentSourceDataEle['text'] }, {
                      headers: { 'Content-Type': 'application/json' },
                    })
                    .pipe(map((resp) => resp.data)),
                );
                newContent.result.readingComplexity = rcResponse.total_score;
              } catch (_rcErr) {
                // Non-fatal: log and continue without readingComplexity
                console.error(`[PUT /:id] getReadingComplexity failed for lang=${contentSourceDataEle['language']}`, _rcErr?.message);
              }
            }

            return { ...contentSourceDataEle, ...newContent.result };
          } else if (contentSourceDataEle['language'] === 'en') {
            const url = process.env.ALL_TEXT_EVAL_URL + 'getPhonemes';

            const textData = {
              text: contentSourceDataEle['text'],
            };

            const newContent = await lastValueFrom(
              this.httpService
                .post(url, JSON.stringify(textData), {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                })
                .pipe(map((resp) => resp.data)),
            );

            const text = contentSourceDataEle['text'].replace(/[^\w\s]/gi, '');

            const totalWordCount = text.split(' ').length;

            const totalSyllableCount = text
              .toLowerCase()
              .replace(/\s+/g, '')
              .split('').length;

            function countWordFrequency(text) {
              // Convert text to lowercase and split it into words
              const words = text
                .toLowerCase()
                .split(/\W+/)
                .filter((word) => word.length > 0);

              // Create an object to store word frequencies
              const wordFrequency = {};

              // Count the frequency of each word
              words.forEach((word) => {
                if (wordFrequency[word]) {
                  wordFrequency[word]++;
                } else {
                  wordFrequency[word] = 1;
                }
              });

              return wordFrequency;
            }

            function countUniqueCharactersPerWord(sentence) {
              // Convert the sentence to lowercase to make the count case-insensitive
              sentence = sentence.toLowerCase();

              // Split the sentence into words
              const words = sentence.split(/\s+/);

              // Create an object to store unique character counts for each word
              const uniqueCharCounts = {};

              // Iterate through each word
              words.forEach((word) => {
                uniqueCharCounts[word] = word
                  .toLowerCase()
                  .replace(/\s+/g, '')
                  .split('').length;
              });

              // Return the object containing unique character counts for each word
              return uniqueCharCounts;
            }

            const frequency = countWordFrequency(text);
            const syllableCountMap = countUniqueCharactersPerWord(text);

            return {
              ...contentSourceDataEle,
              ...newContent,
              wordCount: totalWordCount,
              wordFrequency: frequency,
              syllableCount: totalSyllableCount,
              syllableCountMap: syllableCountMap,
            };
          } else {
            return { ...contentSourceDataEle };
          }
        }),
      );

      content.contentSourceData = updatedcontentSourceData;
      const updatedContent = await this.contentService.update(id, content);

      if (request.user) {
        this.auditLogService.log({
          action: 'UPDATE',
          resource: 'content',
          resourceId: (updatedContent as any).contentId ?? id,
          resourceName: content.name,
          actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
          summary: `Updated content '${content.name}'`,
          ipAddress: request.ip,
        });
      }

      return response.status(HttpStatus.OK).send({
        status: 'success',
        data: updatedContent,
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error,
      });
    }
  }

  @ApiExcludeEndpoint(true)
  @Delete('/:id')
  async delete(@Req() request: any, @Res() response: FastifyReply, @Param('id') id) {
    const deleted = await this.contentService.delete(id);
    if (request.user) {
      this.auditLogService.log({
        action: 'DELETE',
        resource: 'content',
        resourceId: (deleted as any)?.contentId ?? id,
        resourceName: (deleted as any)?.name,
        actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
        summary: `Deleted content '${(deleted as any)?.name ?? id}'`,
        ipAddress: request.ip,
      });
    }
    return response.status(HttpStatus.OK).send({
      deleted,
    });
  }

  @ApiOperation({
    summary: 'Create multilingual data',
    description: 'Create a new multilingual entry with text and audio translations for different languages. Used to store translated content for words and phrases.',
  })
  @ApiBody({
    description: 'Multilingual data to be created',
    schema: {
      type: 'object',
      required: ['multilingual_id', 'multilingual'],
      properties: {
        multilingual_id: {
          type: 'string',
          example: 'TEACHER',
          description: 'Unique identifier for the multilingual entry (typically the English word in uppercase)',
        },
        multilingual: {
          type: 'object',
          description: 'Language-specific translations with text and audio URL',
          additionalProperties: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Translated text in the target language' },
              audio_url: { type: 'string', description: 'Path or URL to the audio file' },
            },
          },
          example: {
            hi: { text: 'शिक्षक', audio_url: 'c8eff92d5.wav' },
            gu: { text: 'શિક્ષક', audio_url: 'b6c0f542e.wav' },
            kn: { text: 'ಶಿಕ್ಷಕ', audio_url: '0d234f9c3.wav' },
            ta: { text: 'ஆசிரியர்', audio_url: 'd9e234f7a.wav' },
            te: { text: 'ఉపాధ్యాయుడు', audio_url: 'e1f345g8b.wav' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Multilingual data created successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '6662d7ff059b133df04db6e3' },
            multilingual_id: { type: 'string', example: 'TEACHER' },
            multilingual: {
              type: 'object',
              example: {
                hi: { text: 'शिक्षक', audio_url: 'c8eff92d5.wav' },
                gu: { text: 'શિક્ષક', audio_url: 'b6c0f542e.wav' },
                kn: { text: 'ಶಿಕ್ಷಕ', audio_url: '0d234f9c3.wav' },
              },
            },
            createdAt: { type: 'string', format: 'date-time', example: '2024-06-07T09:48:00.040Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2024-06-07T09:48:00.040Z' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data provided',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Invalid multilingual data format' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Server error - error message' },
      },
    },
  })
  @Post('/multilingual')
  async createMultilingual(@Req() request: any, @Res() response: FastifyReply, @Body() multilingualData: any) {
    try {
      const newMultilingual = await this.contentService.createMultilingual(multilingualData);
      if (request.user) {
        this.auditLogService.log({
          action: 'CREATE',
          resource: 'multilingual',
          resourceId: multilingualData.multilingual_id,
          actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
          summary: `Created multilingual '${multilingualData.multilingual_id}'`,
          ipAddress: request.ip,
        });
      }
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: newMultilingual
      });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error.message
      });
    }
  }

  @Get('/multilingual')
  async listMultilingual(
    @Res() response: FastifyReply,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    try {
      const result = await this.contentService.findAllMultilingual(
        search || undefined,
        limit ? parseInt(limit) : 20,
        page ? parseInt(page) : 1,
      );
      return response.status(HttpStatus.OK).send({ status: 'success', data: result });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error.message,
      });
    }
  }

  @Get('/multilingual/validate')
  async validateMultilingualWords(
    @Res() response: FastifyReply,
    @Query('words') words: string,
  ) {
    try {
      const wordArr = (words ?? '')
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
      if (wordArr.length === 0) {
        return response.status(HttpStatus.BAD_REQUEST).send({
          status: 'error', message: 'At least one word is required',
        });
      }
      const docs = await this.contentService.getMultilingualDataByIds(wordArr);
      const found = new Set((docs as any[]).map((d) => d.multilingual_id?.toLowerCase()));
      const missing = wordArr.filter((w) => !found.has(w));
      return response.status(HttpStatus.OK).send({ status: 'success', data: { missing } });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error', message: 'Server error - ' + error.message,
      });
    }
  }

  @Get('/multilingual/by-content/:contentId')
  async getMultilingualByContentId(@Res() response: FastifyReply, @Param('contentId') contentId: string) {
    try {
      const item = await this.contentService.findMultilingualByContentId(contentId);
      return response.status(HttpStatus.OK).send({ status: 'success', data: item ?? null });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error.message,
      });
    }
  }

  @Get('/multilingual/:id')
  async getMultilingualById(@Res() response: FastifyReply, @Param('id') id: string) {
    try {
      const item = await this.contentService.findMultilingualById(id);
      if (!item) {
        return response.status(HttpStatus.NOT_FOUND).send({ status: 'error', message: 'Not found' });
      }
      return response.status(HttpStatus.OK).send({ status: 'success', data: item });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error.message,
      });
    }
  }

  @Put('/multilingual/:id')
  async updateMultilingualById(
    @Req() request: any,
    @Res() response: FastifyReply,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    try {
      const updated = await this.contentService.updateMultilingual(id, body);
      if (!updated) {
        return response.status(HttpStatus.NOT_FOUND).send({ status: 'error', message: 'Not found' });
      }
      if (request.user) {
        this.auditLogService.log({
          action: 'UPDATE',
          resource: 'multilingual',
          resourceId: id,
          resourceName: (updated as any)?.multilingual_id,
          actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
          summary: `Updated multilingual '${(updated as any)?.multilingual_id ?? id}'`,
          ipAddress: request.ip,
        });
      }
      return response.status(HttpStatus.OK).send({ status: 'success', data: updated });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error.message,
      });
    }
  }

  @Delete('/multilingual/:id')
  async deleteMultilingualById(@Req() request: any, @Res() response: FastifyReply, @Param('id') id: string) {
    try {
      const deletedMultilingual = await this.contentService.deleteMultilingual(id);
      if (request.user) {
        this.auditLogService.log({
          action: 'DELETE',
          resource: 'multilingual',
          resourceId: id,
          resourceName: (deletedMultilingual as any)?.multilingual_id,
          actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
          summary: `Deleted multilingual '${(deletedMultilingual as any)?.multilingual_id ?? id}'`,
          ipAddress: request.ip,
        });
      }
      return response.status(HttpStatus.OK).send({ status: 'success', message: 'Deleted' });
    } catch (error) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Server error - ' + error.message,
      });
    }
  }
}
