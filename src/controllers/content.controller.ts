import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { contentService } from '../services/content.service';
import { CollectionService } from '../services/collection.service';
import { FastifyReply } from 'fastify';
import { HttpService } from '@nestjs/axios';
import { catchError, lastValueFrom, map, timeout } from 'rxjs';
import * as splitGraphemes from 'split-graphemes';
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
import { JwtAuthGuard } from 'src/auth/auth.guard';
import en_config from 'src/config/language/en';
import common_config from 'src/config/commonConfig';
import {
  ExternalServiceException,
  ExternalServiceTimeoutException,
  ResourceNotFoundException,
  ValidationException,
} from 'src/common/exceptions/api.exceptions';

@ApiTags('content')
@ApiBearerAuth('access-token')
@Controller('content')
@UseGuards(JwtAuthGuard)
export class contentController {
  private readonly logger = new Logger(contentController.name);

  constructor(
    private readonly contentService: contentService,
    private readonly collectionService: CollectionService,
    private readonly httpService: HttpService,
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
  async create(@Res() response: FastifyReply, @Body() content: any) {
    try {
      if (!Array.isArray(content?.contentSourceData)) {
        throw new ValidationException('contentSourceData must be an array.');
      }
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

            const newContent = await this.callExternalApi(
              url,
              textData,
              8000,
              'LC_SERVICE_ANALYSIS',
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
            delete newContent.result.syllableCount;
            delete newContent.result.syllableCountMap;

            async function getSyllableCount(text) {
              return splitGraphemes.splitGraphemes(
                text.replace(
                  /[\u200B\u200C\u200D\uFEFF\s!@#$%^&*()_+{}\[\]:;<>,.?\/\\|~'"-=]/g,
                  '',
                ),
              ).length;
            }

            const syllableCount = await getSyllableCount(
              contentSourceDataEle['text'],
            );

            const syllableCountMap = {};

            for (const wordEle of contentSourceDataEle['text'].split(' ')) {
              syllableCountMap[wordEle] = await getSyllableCount(wordEle);
            }
            if (common_config.readingComplexityLang.includes(contentSourceDataEle['language'])) {
              
              const urls = process.env.ALL_TEXT_EVAL_URL + 'getReadingComplexity';

              const reqBody = {
                language: contentSourceDataEle['language'],
                text: contentSourceDataEle['text'],
              };
              const readingComplexity = await this.callExternalApi(
                urls,
                reqBody,
                8000,
                'TEXT_EVAL_READING_COMPLEXITY',
              );
              newContent.result.readingComplexity = readingComplexity.total_score;
            }

            newContent.result.wordMeasures = newWordMeasures;

            return {
              ...contentSourceDataEle,
              ...newContent.result,
              syllableCount: syllableCount,
              syllableCountMap: syllableCountMap,
            };
          } else if (contentSourceDataEle['language'] === 'en') {
            const url = process.env.ALL_TEXT_EVAL_URL + 'getPhonemes';

            const textData = {
              text: contentSourceDataEle['text'],
            };

            const newContent = await this.callExternalApi(
              url,
              textData,
              10000,
              'TEXT_EVAL_PHONEMES',
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

      const newContent = await this.contentService.create(content);

      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: newContent,
      });
    } catch (error) {
      throw error;
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
      throw error;
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
      throw error;
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
      if (!data || data.length === 0) {
        throw new ResourceNotFoundException('No content found for pagination.');
      }
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      this.logger.log(
        JSON.stringify({
          api: 'content.getContent',
          stage: 'start',
          language: queryData?.language,
          contentType: queryData?.contentType,
          story_mode: queryData?.story_mode,
          mechanics_id: queryData?.mechanics_id ?? null,
          limit: queryData?.limit,
          tagsType: Array.isArray(queryData?.tags) ? 'array' : typeof queryData?.tags,
        }),
      );
      const Batch: any = queryData.limit || 5;
      let contentCollection;
      let collectionId;

      const tags = queryData.language === 'en' ? en_config.tags : common_config.tags;
            // Guard and log tags evaluation
      const incomingTags: string[] = Array.isArray(queryData?.tags) ? queryData.tags : [];
      this.logger.debug(
        JSON.stringify({
          api: 'content.getContent',
          stage: 'tags-eval',
          tagsConfiguredCount: Array.isArray(tags) ? tags.length : null,
          incomingTagsCount: incomingTags.length,
        }),
      );

      if (tags.some(tag => queryData.tags.some(qtag => qtag.includes(tag)))) {
        queryData.cLevel = "";
        queryData.complexityLevel = "";
        queryData.graphemesMappedObj = {};
        queryData.level_competency = [];
        queryData.tokenArr = [];
        this.logger.debug(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'tags-reset-applied',
          }),
        );
      }

      if (
        queryData.story_mode === 'true' &&
        queryData.level_competency.length > 0
      ) {
        this.logger.log(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'story-mode-branch',
            level_competency_count: Array.isArray(queryData?.level_competency) ? queryData.level_competency.length : 0,
          }),
        );
        collectionId = await this.collectionService.getCompetencyCollections(
          queryData.level_competency,
          queryData.language,
          queryData.contentType,
          queryData.CEFR_level,
        );
        this.logger.debug(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'got-collectionId',
            collectionId,
          }),
        );
        const contentData = await this.contentService.pagination(
          0,
          parseInt(Batch),
          queryData.contentType,
          collectionId,
        );
        this.logger.debug(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'pagination-done',
            items: Array.isArray(contentData?.data) ? contentData.data.length : null,
          }),
        );
        let contentArr = contentData['data'];

        if (contentArr.length === 0) {
          this.logger.debug(
            JSON.stringify({
              api: 'content.getContent',
              stage: 'fallback-search',
              reason: 'empty-pagination',
            }),
          );
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
              this.logger.debug(
                JSON.stringify({
                  api: 'content.getContent',
                  stage: 'fallback-search-done',
                  words: Array.isArray(contentArr) ? contentArr.length : null,
                }),
              );
            });
        }

        if (queryData.mechanics_id !== undefined) {
          this.logger.debug(
            JSON.stringify({
              api: 'content.getContent',
              stage: 'mechanics-filter-on-story',
              mechanics_id: queryData.mechanics_id,
              itemsBefore: Array.isArray(contentArr) ? contentArr.length : null,
            }),
          );
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
          this.logger.debug(
            JSON.stringify({
              api: 'content.getContent',
              stage: 'mechanics-filter-complete',
            }),
          );
        }

        contentCollection = { wordsArr: contentArr };
        this.logger.log(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'story-mode-branch-exit',
            words: Array.isArray(contentCollection?.wordsArr) ? contentCollection.wordsArr.length : null,
          }),
        );
      }

      if (queryData.mechanics_id === undefined && collectionId === undefined) {
        this.logger.log(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'search-branch',
            limitParsed: parseInt(Batch.limit || Batch),
          }),
        );
        contentCollection = await this.contentService.search(
          queryData.tokenArr,
          queryData.language,
          queryData.contentType,
          parseInt(Batch.limit || Batch),
          queryData.tags,
          queryData.cLevel,
          queryData.complexityLevel,
          queryData.graphemesMappedObj,
          queryData.level_competency,
          queryData.CEFR_level,
        );
        this.logger.log(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'search-branch-exit',
            words: Array.isArray(contentCollection?.wordsArr) ? contentCollection.wordsArr.length : null,
          }),
        );
      } else {
        this.logger.log(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'mechanics-branch',
            mechanics_id: queryData.mechanics_id,
            limitParsed: parseInt(Batch.limit || Batch),
          }),
        );
        contentCollection = await this.contentService.getMechanicsContentData(
          queryData.contentType,
          queryData.mechanics_id,
          parseInt(Batch.limit || Batch),
          queryData.language,
          queryData.level_competency,
          queryData.tags,
          queryData.CEFR_level,
        );
        this.logger.log(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'mechanics-branch-exit',
            words: Array.isArray(contentCollection?.wordsArr) ? contentCollection.wordsArr.length : null,
          }),
        );
      }

      // Enhance data with multilingual information for imageAudioMap
      if (contentCollection?.wordsArr?.length > 0) {
        this.logger.debug(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'multilingual-enhance-start',
            words: contentCollection.wordsArr.length,
          }),
        );
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
                    this.logger.verbose(
                      JSON.stringify({
                        api: 'content.getContent',
                        stage: 'multilingual-fetch-mechanics',
                        multilingualIdsCount: multilingualIds.length,
                      }),
                    );
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
                this.logger.verbose(
                  JSON.stringify({
                    api: 'content.getContent',
                    stage: 'multilingual-fetch-contentSourceData',
                    multilingualIdsCount: Array.isArray(sourceData.multilingual_id) ? sourceData.multilingual_id.length : 0,
                  }),
                );
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
        this.logger.debug(
          JSON.stringify({
            api: 'content.getContent',
            stage: 'multilingual-enhance-end',
            words: Array.isArray(contentCollection?.wordsArr) ? contentCollection.wordsArr.length : null,
          }),
        );
      }

      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: contentCollection,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          api: 'content.getContent',
          stage: 'error',
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
        }),
      );
      throw error;
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
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get assessment collections',
    description: 'Retrieve assessment collections filtered by tags and language. For ASER assessments, returns collections across all 6 sets.',
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
        for (let setno = 1; setno <= 6; setno++) {
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
      throw error;
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
      throw error;
    }
  }

  @ApiExcludeEndpoint(true)
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
      throw error;
    }
  }

  @ApiExcludeEndpoint(true)
  @Get('/getByIds')
  async findByIds(@Res() response: FastifyReply, @Query('ids') ids: string) {
    try {
      if (!ids) {
        throw new ValidationException('ids query parameter is required.');
      }
      const idList = ids.split(',').map(id => id.trim());

      const contents = await this.contentService.readByIds(idList);
      if (!contents || contents.length === 0) {
        throw new ResourceNotFoundException('No content found for provided ids.');
      }

      return response.status(HttpStatus.OK).send({
        contents,
        count: contents.length,
      });
    } catch (error) {
      throw error;
    }
  }


  @ApiExcludeEndpoint(true)
  @Put('/:id')
  async update(
    @Res() response: FastifyReply,
    @Param('id') id,
    @Body() content: any,
  ) {
    try {
      if (!id) {
        throw new ValidationException('id is required.');
      }
      if (!Array.isArray(content?.contentSourceData)) {
        throw new ValidationException('contentSourceData must be an array.');
      }
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

            const newContent = await this.callExternalApi(
              url,
              textData,
              8000,
              'LC_SERVICE_ANALYSIS',
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

            return { ...contentSourceDataEle, ...newContent.result };
          } else if (contentSourceDataEle['language'] === 'en') {
            const url = process.env.ALL_TEXT_EVAL_URL + 'getPhonemes';

            const textData = {
              text: contentSourceDataEle['text'],
            };

            const newContent = await this.callExternalApi(
              url,
              textData,
              10000,
              'TEXT_EVAL_PHONEMES',
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
      if (!updatedContent) {
        throw new ResourceNotFoundException('data is not available for this _id');
      }

      return response.status(HttpStatus.OK).send({
        status: 'success',
        data: updatedContent,
      });
    } catch (error) {
      throw error;
    }
  }

  @ApiExcludeEndpoint(true)
  @Delete('/:id')
  async delete(@Res() response: FastifyReply, @Param('id') id) {
    if (!id) {
      throw new ValidationException('id is required.');
    }
    const deleted = await this.contentService.delete(id);
    if (!deleted) {
      throw new ResourceNotFoundException('data is not available for this _id');
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
  async createMultilingual(@Res() response: FastifyReply, @Body() multilingualData: any) {
    try {
      const newMultilingual = await this.contentService.createMultilingual(multilingualData);
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: newMultilingual
      });
    } catch (error) {
      throw error;
    }
  }

  private async callExternalApi(
    url: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
    serviceName: string,
  ): Promise<any> {
    try {
      return await lastValueFrom(
        this.httpService
          .post(url, payload, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            timeout(timeoutMs),
            map((resp) => resp.data),
            catchError((error) => {
              this.logger.error(
                JSON.stringify({
                  apiName: 'content.externalCall',
                  serviceName,
                  timestamp: new Date().toISOString(),
                  error: {
                    name: error?.name || 'Error',
                    message: error?.message || 'External API call failed',
                  },
                }),
              );
              throw error;
            }),
          ),
      );
    } catch (error) {
      if (error?.name === 'TimeoutError') {
        throw new ExternalServiceTimeoutException(
          `${serviceName} timed out while processing request.`,
        );
      }
      throw new ExternalServiceException(
        `${serviceName} is currently unavailable. Please try again later.`,
      );
    }
  }
}
