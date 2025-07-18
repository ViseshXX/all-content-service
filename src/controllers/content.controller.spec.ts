import { Test, TestingModule } from '@nestjs/testing';
import { contentController } from './content.controller';
import { contentService } from '../services/content.service';
import { CollectionService } from '../services/collection.service';
import { HttpService } from '@nestjs/axios';
import { FastifyReply } from 'fastify';
import { of, throwError } from 'rxjs';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { content } from 'src/schemas/content.schema';
import en_config from '../config/language/en';


// Mock the en_config module before imports
jest.mock('src/config/language/en', () => ({
  __esModule: true,
  default: {
    language_code: 'en',
    tags: ['CEFR_GEN_M1_P1', 'CEFR_GEN_M1_P2', 'ASER'],
    contentLevel: []
  }
}));

// Mock the JWT service
jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
    sign: jest.fn(),
  })),
}));

// Mock the auth guard
jest.mock('../auth/auth.guard', () => ({
  JwtAuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockReturnValue(true),
  })),
}));

// Mock the content service methods
jest.mock('../services/content.service', () => ({
  contentService: jest.fn().mockImplementation(() => ({
    search: jest.fn(),
    searchByFilter: jest.fn(),
    pagination: jest.fn(),
    getRandomContent: jest.fn(),
    getContentWord: jest.fn(),
    getContentSentence: jest.fn(),
    getContentParagraph: jest.fn(),
    readAll: jest.fn(),
    countAll: jest.fn(),
    readById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    charNotPresent: jest.fn(),
    getMechanicsContentData: jest.fn(),
    getContentLevelData: jest.fn(),
  })),
}));

// Mock the collection service methods
jest.mock('../services/collection.service', () => ({
  CollectionService: jest.fn().mockImplementation(() => ({
    getAssessment: jest.fn(),
    getCompetencyCollections: jest.fn(),
    getTypeOfLearner: jest.fn(),
  })),
}));



describe('contentController', () => {
  let controller: contentController;
  let service: contentService;
  let httpService: HttpService;
  let collectionService: CollectionService;

  const mockReply: Partial<FastifyReply> = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [contentController],
      providers: [
        {
          provide: contentService,
          useValue: {
            search: jest.fn(),
            searchByFilter: jest.fn(),
            pagination: jest.fn(),
            getRandomContent: jest.fn(),
            getContentWord: jest.fn(),
            getContentSentence: jest.fn(),
            getContentParagraph: jest.fn(),
            readAll: jest.fn(),
            countAll: jest.fn(),
            readById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            charNotPresent: jest.fn(),
            getMechanicsContentData: jest.fn(),
            getContentLevelData: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: CollectionService,
          useValue: {
            getAssessment: jest.fn(),
            getCompetencyCollections: jest.fn(),
            getTypeOfLearner: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: 'JwtService',
          useValue: {
            verify: jest.fn(),
            sign: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<contentController>(contentController);
    service = module.get<contentService>(contentService);
    httpService = module.get<HttpService>(HttpService);
    collectionService = module.get<CollectionService>(CollectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- Test: POST /content ----------
  describe('create', () => {
    const reqBody = {
      collectionId: 'some-uuid',
      name: 'Example Content',
      contentType: 'Sentence',
      contentSourceData: [
        { language: 'en', text: 'Hello world', audioUrl: '' },
      ],
      status: 'live',
      publisher: 'ekstep',
      language: 'en',
      contentIndex: 1,
      tags: [],
      imagePath: 'image.jpg',
    };

    const mockPhonemeData = {
      phonemes: ['HH', 'AH', 'L', 'OW'],
    };
    const mockAxiosResponse = {
      data: mockPhonemeData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    };

    const mockContent = {
      contentId: 'test-content-id',
      collectionId: 'test-collection-id',
      name: 'Test Content',
      contentType: 'text',
      imagePath: '/path/to/image',
      contentSourceData: [
        {
          text: 'apple',
          phonemes: ['AE', 'P', 'AH', 'L'],
          syllableCount: 2,
        },
      ] as any, // Keep as any if 'contentSourceData' is also a complex type
      mechanics_data: [
        {
          mechanics_id: '0f9bbf52-6c35-49bb-9cd4-4aea2be642fe',
          language: 'en',
          text: 'Sample text', // If 'text' is optional in the content schema, this is fine
          audio_url: '',
          image_url: '',
          options: [
            {
              text: 'Option 1',
              audio_url: '',
              image_url: '',
              isAns: true,
              side: 'left',
            },
          ],
          hints: {
            text: 'Hint text',
            audio_url: '',
            image_url: '',
          },
          time_limit: 90,
          correctness: { '50%': ['Option 1'] },
        },
      ] as any, // Make sure this array always has exactly ONE element to match the tuple
      level_complexity: {
        level: 'beginner',
        level_competency: 'basic',
      },
      flaggedBy: '',
      lastFlaggedOn: '',
      flagReasons: '',
      reviewer: '',
      reviewStatus: '',
      status: 'active',
      publisher: 'test-publisher',
      language: 'en',
      contentIndex: 1,
      tags: ['test'] as [string], // Ensure this matches the exact tuple or array type expected for 'tags'
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create content successfully for English text', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockAxiosResponse));
      jest.spyOn(service, 'create').mockResolvedValue(mockContent);

      await controller.create(mockReply as FastifyReply, reqBody);

      expect(httpService.post).toHaveBeenCalled();
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining(reqBody),
      );
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockContent,
      });
    });

    it('should handle server errors gracefully', async () => {
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error('API down')));

      await controller.create(mockReply as FastifyReply, reqBody);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: expect.stringContaining('Server error'),
      });
    });
  });

  // ---------- Test: POST /content/search ----------
  describe('searchContent', () => {
    const tokenData = {
      tokenArr: ['Hello', 'World'],
      language: 'en',
      contentType: 'Sentence',
      limit: 10,
      tags: ['greeting'],
      cLevel: 'Level 1',
      complexityLevel: 'low',
      graphemesMappedObj: { H: 'HH', e: 'EH' },
    };

    const mockSearchResult = [
      {
        _id: 'content123',
        name: 'Hello World',
        language: 'en',
        contentType: 'Sentence',
      },
    ];

    it('should return matching content', async () => {
      jest.spyOn(service, 'search').mockResolvedValue(mockSearchResult);

      await controller.searchContent(mockReply as FastifyReply, tokenData);

      expect(service.search).toHaveBeenCalledWith(
        tokenData.tokenArr,
        tokenData.language,
        tokenData.contentType,
        tokenData.limit,
        tokenData.tags,
        tokenData.cLevel,
        tokenData.complexityLevel,
        tokenData.graphemesMappedObj,
      );

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockSearchResult,
      });
    });

    it('should return 500 on error', async () => {
      const error = new Error('Search failed');
      jest.spyOn(service, 'search').mockRejectedValue(error);

      await controller.searchContent(mockReply as FastifyReply, tokenData);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  // ---------- Test: POST /charNotPresent ----------
  describe('charNotPresentContent', () => {
    const tokenData = {
      tokenArr: ['char1', 'char2'],
    };

    const mockReply: Partial<FastifyReply> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const mockResult = [
      {
        contentId: 'abcd-1234',
        name: 'Sample Content',
        language: 'en',
        contentType: 'Word',
        status: 'live',
      },
    ];

    it('should return content not having the specified characters', async () => {
      jest
        .spyOn(service, 'charNotPresent')
        .mockResolvedValue(mockResult);

      await controller.charNotPresentContent(
        mockReply as FastifyReply,
        tokenData,
      );

      expect(service.charNotPresent).toHaveBeenCalledWith(
        tokenData.tokenArr,
      );
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockResult,
      });
    });

    it('should return 500 if service throws an error', async () => {
      const error = new Error('Some DB error');
      jest
        .spyOn(service, 'charNotPresent')
        .mockRejectedValue(error);

      await controller.charNotPresentContent(
        mockReply as FastifyReply,
        tokenData,
      );

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('pagination', () => {
    const queryParams = {
      type: 'Sentence',
      collectionId: '3f0192af-0720-4248-b4d4-d99a9f731d4f',
      page: 1,
      limit: 10,
    };

    const mockPaginationData = {
      data: [
        {
          _id: '660f96ff367a62b3902de539',
          contentId: '78f1d29a-2576-49d7-8919-312d0732992d',
          contentType: 'Sentence',
          contentSourceData: [
            {
              text: 'Abdul loves to play cricket.',
              phonemes: [
                'æ',
                'b',
                'd',
                'u',
                'l',
                'l',
                'ə',
                'v',
                'z',
                't',
                'ɪ',
                'p',
                'l',
                'e',
                'ɪ',
                'k',
                'r',
                'ɪ',
                'k',
                'ɪ',
                't',
              ],
              syllableCount: 23,
            },
          ],
          language: 'en',
          contentIndex: 1,
        },
      ],
      status: 200, // ✅ Add this
    };

    it('should return paginated content with total syllable count (English)', async () => {
      jest.spyOn(service, 'pagination').mockResolvedValue(mockPaginationData);

      await controller.pagination(
        mockReply as FastifyReply,
        queryParams.type,
        queryParams.collectionId,
        queryParams.page,
        { limit: queryParams.limit },
      );

      expect(service.pagination).toHaveBeenCalledWith(
        0, // skip = (page - 1) * limit = 0
        10,
        'Sentence',
        '3f0192af-0720-4248-b4d4-d99a9f731d4f',
      );

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockPaginationData.data,
        totalSyllableCount: 21, // 6 phonemes in first (and only) contentSourceData
      });
    });

    it('should handle internal server error', async () => {
      jest
        .spyOn(service, 'pagination')
        .mockRejectedValue(new Error('Database failure'));

      await controller.pagination(
        mockReply as FastifyReply,
        queryParams.type,
        queryParams.collectionId,
        queryParams.page,
        { limit: queryParams.limit },
      );

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: expect.stringContaining('Server error'),
      });
    });
  });

  describe('getRandomContent', () => {
    const query = {
      type: 'Sentence',
      language: 'en',
      limit: 3,
    };

    const mockData = [
      {
        contentId: 'abc123',
        contentType: 'Sentence',
        language: 'en',
        contentSourceData: [
          {
            text: 'What do you see?',
            phonemes: ['W', 'AH', 'T', 'D', 'UW'],
            syllableCount: 5,
          },
        ],
      },
    ];

    it('should return random content', async () => {
      jest
        .spyOn(service, 'getRandomContent')
        .mockResolvedValue({ data: mockData, status: 200 });

      await controller.getRandomContent(
        mockReply as FastifyReply,
        query.type,
        query.language,
        { limit: query.limit },
      );

      expect(service.getRandomContent).toHaveBeenCalledWith(
        query.limit,
        query.type,
        query.language,
      );
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockData,
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Something went wrong');
      jest.spyOn(service, 'getRandomContent').mockRejectedValue(error);

      await controller.getRandomContent(
        mockReply as FastifyReply,
        query.type,
        query.language,
        { limit: query.limit },
      );

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('getContentWord', () => {
    const mockReply: Partial<FastifyReply> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const mockData = [
      {
        _id: '12345',
        contentType: 'Word',
        contentSourceData: [
          {
            text: 'apple',
            phonemes: ['AE', 'P', 'AH', 'L'],
            syllableCount: 2,
          },
        ],
        language: 'en',
        contentId: 'abcde-12345',
      },
    ];

    it('should return word content successfully', async () => {
      jest
        .spyOn(service, 'getContentWord')
        .mockResolvedValue({ data: mockData, status: 200 });

      await controller.getContentWord(mockReply as FastifyReply, 'en', {
        limit: 5,
      });

      expect(service.getContentWord).toHaveBeenCalledWith(5, 'en');
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockData,
      });
    });

    it('should return 500 if service throws error', async () => {
      const error = new Error('DB error');
      jest.spyOn(service, 'getContentWord').mockRejectedValue(error);

      await controller.getContentWord(mockReply as FastifyReply, 'en', {
        limit: 5,
      });

      expect(service.getContentWord).toHaveBeenCalledWith(5, 'en');
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('getContentSentence', () => {
    const mockReply: Partial<FastifyReply> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const mockData = [
      {
        _id: '67890',
        contentType: 'Sentence',
        contentSourceData: [
          {
            text: 'The cat sat on the mat.',
            phonemes: ['DH', 'AH', 'K', 'AE', 'T'],
            syllableCount: 6,
          },
        ],
        language: 'en',
        contentId: 'sentence-98765',
      },
    ];

    it('should return sentence content successfully', async () => {
      jest
        .spyOn(service, 'getContentSentence')
        .mockResolvedValue({ data: mockData, status: 200 });

      await controller.getContentSentence(mockReply as FastifyReply, 'en', {
        limit: 5,
      });

      expect(service.getContentSentence).toHaveBeenCalledWith(5, 'en');
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockData,
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Some DB error');
      jest.spyOn(service, 'getContentSentence').mockRejectedValue(error);

      await controller.getContentSentence(mockReply as FastifyReply, 'en', {
        limit: 5,
      });

      expect(service.getContentSentence).toHaveBeenCalledWith(5, 'en');
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('getContentParagraph', () => {
    const mockReply: Partial<FastifyReply> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const mockData = [
      {
        _id: 'abc123',
        contentType: 'Paragraph',
        contentSourceData: [
          {
            text: 'This is a paragraph containing several sentences.',
            phonemes: ['DH', 'IH', 'S'],
            syllableCount: 10,
          },
        ],
        language: 'en',
        contentId: 'para-1234',
      },
    ];

    it('should return paragraph content successfully', async () => {
      jest
        .spyOn(service, 'getContentParagraph')
        .mockResolvedValue({ data: mockData, status: 200 });

      await controller.getContentParagraph(mockReply as FastifyReply, 'en', {
        limit: 5,
      });

      expect(service.getContentParagraph).toHaveBeenCalledWith(5, 'en');
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockData,
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Paragraph fetch error');
      jest.spyOn(service, 'getContentParagraph').mockRejectedValue(error);

      await controller.getContentParagraph(mockReply as FastifyReply, 'en', {
        limit: 5,
      });

      expect(service.getContentParagraph).toHaveBeenCalledWith(5, 'en');
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('getContent', () => {
    const tokenQueryData = {
      tokenArr: ['word1', 'word2'],
      language: 'en',
      contentType: 'Word',
      tags: ['tag1'],
      cLevel: 'Level 1',
      complexityLevel: 'low',
      graphemesMappedObj: { w: 'W', o: 'OW' },
      level_competency: ['L1.1'],
      CEFR_level: 'A1',
      mechanics_id: 'mech123',
      story_mode: 'true',
      limit: 5,
    };

    const mockReply: Partial<FastifyReply> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const mockCollectionId = 'col123';

    const mockPaginatedContent = {
      data: [
        {
          contentId: 'abc123',
          mechanics_data: [
            {
              mechanics_id: 'm1',
              language: 'en',
              options: [],
            },
          ],
        },
      ],
      status: 200, // or whatever status code is appropriate
    };

    const mockSearchResult = {
      wordsArr: [
        {
          contentId: 'cX',
          mechanics_data: [
            {
              mechanics_id: 'm1',
              language: 'en',
              options: [],
            },
          ],
        },
      ],
    };

    it('should return story_mode content', async () => {
      const mockSearchResult = {
        data: [
          {
            contentId: 'cX',
            mechanics_data: [
              {
                language: 'en',
                mechanics_id: 'm1',
                options: [],
              },
            ],
          },
        ],
        status: 200,
      };

      jest.spyOn(service, 'pagination').mockResolvedValue({ data: mockSearchResult.data, status: 200 });
      jest.spyOn(collectionService, 'getCompetencyCollections').mockResolvedValue('test-collection-id' as any);
      jest.spyOn(service, 'getMechanicsContentData').mockResolvedValue({ wordsArr: mockSearchResult.data });

      await controller.getContent(mockReply as FastifyReply, {
        story_mode: 'true',
        collectionId: 'test-collection',
        contentType: 'Word',
        page: 0,
        limit: 5,
        tags: [], // Provide empty tags to avoid en_config issue
        tokenArr: [],
        language: 'en',
        cLevel: '',
        complexityLevel: [],
        graphemesMappedObj: {},
        level_competency: ['competency1'], // Add competency to trigger pagination
        CEFR_level: [],
        mechanics_id: 'test-mechanics-id', // Add mechanics_id to avoid the else branch
      });

      expect(service.pagination).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: { wordsArr: mockSearchResult.data },
      });
    });

    it('should call search when story_mode is off and mechanics_id is not present', async () => {
      const queryData = {
        ...tokenQueryData,
        story_mode: 'false',
        mechanics_id: undefined,
        tags: [], // Ensure tags is an array
      };

      jest.spyOn(service, 'search').mockResolvedValue(mockSearchResult);

      await controller.getContent(mockReply as FastifyReply, queryData);

      expect(service.search).toHaveBeenCalledWith(
        queryData.tokenArr,
        queryData.language,
        queryData.contentType,
        queryData.limit,
        queryData.tags,
        queryData.cLevel,
        queryData.complexityLevel,
        queryData.graphemesMappedObj,
        queryData.level_competency,
        queryData.CEFR_level,
      );
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockSearchResult,
      });
    });

    it('should call getMechanicsContentData if mechanics_id is provided', async () => {
      const queryData = {
        ...tokenQueryData,
        story_mode: 'false',
        tags: [], // Ensure tags is an array
      };

      const mockMechData = { wordsArr: [{ contentId: 'cX' }] };

      jest
        .spyOn(service, 'getMechanicsContentData')
        .mockResolvedValue(mockMechData);

      await controller.getContent(mockReply as FastifyReply, queryData);

      expect(service.getMechanicsContentData).toHaveBeenCalledWith(
        queryData.contentType,
        queryData.mechanics_id,
        queryData.limit,
        queryData.language,
        queryData.level_competency,
        queryData.tags,
        queryData.CEFR_level,
      );

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockMechData,
      });
    });

    it('should return 500 on error', async () => {
      const error = new Error('DB crash');
      jest.spyOn(service, 'search').mockRejectedValue(error);

      // Mock the controller to handle the error properly
      await controller.getContent(mockReply as FastifyReply, {
        story_mode: 'false',
        tokenArr: ['test'],
        language: 'en',
        contentType: 'Word',
        limit: 5,
        tags: [], // Ensure tags is an array
        cLevel: 'L1',
        complexityLevel: [],
        graphemesMappedObj: {},
        level_competency: [],
        CEFR_level: [],
      });

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - Error: DB crash',
      });
    });
  });

  describe('getContentByFilters', () => {
    const queryData = {
      syllableList: ['ba', 'na'],
      syllableCount: 3,
      wordCount: 2,
      totalOrthoComplexity: 1.4,
      totalPhonicComplexity: 1.1,
      meanPhonicComplexity: 0.8,
      language: 'en',
      contentType: 'Word',
      limit: 5,
      contentId: 'cid123',
      collectionId: 'col456',
      tags: ['tag1'],
    };

    const mockFilteredContent = [
      {
        contentId: 'abc-123',
        name: 'banana',
        language: 'en',
        contentType: 'Word',
        syllableCount: 3,
        wordCount: 1,
        status: 'live',
      },
    ];

    it('should return filtered content based on provided filters', async () => {
      jest
        .spyOn(service, 'searchByFilter')
        .mockResolvedValue(mockFilteredContent);

      await controller.getContentByFilters(
        mockReply as FastifyReply,
        queryData,
      );

      expect(service.searchByFilter).toHaveBeenCalledWith(
        queryData.syllableList,
        queryData.syllableCount,
        queryData.wordCount,
        queryData.totalOrthoComplexity,
        queryData.totalPhonicComplexity,
        queryData.meanPhonicComplexity,
        queryData.language,
        queryData.contentType,
        5,
        queryData.contentId,
        queryData.collectionId,
        queryData.tags,
      );

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockFilteredContent,
      });
    });

    it('should return 500 on error from service', async () => {
      const error = new Error('DB crash');
      jest.spyOn(service, 'searchByFilter').mockRejectedValue(error);

      await controller.getContentByFilters(
        mockReply as FastifyReply,
        queryData,
      );

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - Error: DB crash',
      });
    });
  });

  describe('getAssessment', () => {
    const mockReply: Partial<FastifyReply> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const mockAssessmentData = {
      data: [
        {
          _id: '65e88b6cdee499a6209e739e',
          name: '(மாதிறி -4)எழுத்து',
          category: 'Char',
          collectionId: 'ed47eb63-87c8-41f4-821d-1400fef37b78',
        },
      ],
      status: 200, // ✅ add this to match the expected return type
    };

    it('should return assessment collections for ASER tags', async () => {
      const queryData = {
        tags: ['ASER'],
        language: 'ta',
      };

      const getAssessmentMock = jest
        .spyOn(collectionService, 'getAssessment')
        .mockResolvedValue(mockAssessmentData);

      await controller.getAssessment(mockReply as FastifyReply, queryData);

      expect(getAssessmentMock).toHaveBeenCalledTimes(5); // for set1 to set5
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        data: expect.any(Array),
        status: 200,
      });
    });

    it('should return assessment collections for non-ASER tags', async () => {
      const queryData = {
        tags: ['Grade1'],
        language: 'ta',
      };

      const getAssessmentMock = jest
        .spyOn(collectionService, 'getAssessment')
        .mockResolvedValue(mockAssessmentData);

      await controller.getAssessment(mockReply as FastifyReply, queryData);

      expect(getAssessmentMock).toHaveBeenCalledWith(
        queryData.tags,
        queryData.language,
      );
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith(mockAssessmentData);
    });

    it('should return 500 if service throws error', async () => {
      const queryData = {
        tags: ['ASER'],
        language: 'ta',
      };

      const error = new Error('DB Error');
      jest.spyOn(collectionService, 'getAssessment').mockRejectedValue(error);

      await controller.getAssessment(mockReply as FastifyReply, queryData);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('getContentForMileStone', () => {
    const queryData = {
      cLevel: 'L1',
      complexityLevel: 'L1.1',
      language: 'ta',
      limit: 5,
      contentType: 'Sentence',
    };

    const mockContentCollection = {
      data: [
        {
          contentId: 'abc123',
          name: 'Sample sentence',
          language: 'ta',
          contentType: 'Sentence',
          level_complexity: { level: 'L1', level_competency: 'L1.1' },
          status: 'live',
        },
      ],
      status: 200,
    };

    it('should return milestone content successfully', async () => {
      jest
        .spyOn(service, 'getContentLevelData')
        .mockResolvedValue(mockContentCollection);

      await controller.get(mockReply as FastifyReply, queryData);

      expect(service.getContentLevelData).toHaveBeenCalledWith(
        queryData.cLevel,
        queryData.complexityLevel,
        queryData.language,
        queryData.limit,
        queryData.contentType,
      );

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        contentCollection: mockContentCollection,
      });
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('DB error');
      jest.spyOn(service, 'getContentLevelData').mockRejectedValue(error);

      const mockRes: Partial<FastifyReply> = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.get(mockRes as FastifyReply, queryData);

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockRes.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('fetchAll', () => {
  const mockContentList: content[] = [
  {
    contentId: 'uuid-1234',
    collectionId: 'col-5678',
    name: 'Example Content',
    contentType: 'Sentence',
    imagePath: 'image/path.png',
    contentSourceData: [
      {
        language: 'en',
        text: 'This is a sentence.',
        phonemes: ['DH', 'IH', 'S'],
        audioUrl: '',
        wordCount: 4,
        wordFrequency: { this: 1, is: 1, a: 1, sentence: 1 },
        syllableCount: 5,
        syllableCountMap: { this: 1, is: 1, a: 1, sentence: 2 },
      } as any,
    ],
    mechanics_data: [
      {
        mechanics_id: '',
        language: '',
        content_body: '',
        jumbled_text: '',
        text: '',
        audio_url: '',
        image_url: '',
        options: [],
        hints: {
          text: '',
          audio_url: '',
          image_url: '',
        },
        time_limit: 0,
        correctness: {},
      } as any,
    ], // provide a default object to satisfy tuple type
    level_complexity: {
      level: 'L1',
      level_competency: 'L1.1',
      CEFR_level: 'A1',
    },
    flaggedBy: '',
    lastFlaggedOn: '',
    flagReasons: '',
    reviewer: '',
    reviewStatus: '',
    status: 'live',
    publisher: 'ekstep',
    language: 'en',
    contentIndex: 1,
    tags: ['education'], // ✅ array, not tuple
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];


    const mockCount = 40;

    it('should return paginated content successfully', async () => {
      jest.spyOn(service, 'readAll').mockResolvedValue(mockContentList);
      jest.spyOn(service, 'countAll').mockResolvedValue(mockCount);

      await controller.fetchAll(mockReply as FastifyReply, 1, 20);

      expect(service.readAll).toHaveBeenCalledWith(1, 20);
      expect(service.countAll).toHaveBeenCalled();

      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        recordCount: mockCount,
        pageCount: Math.trunc(mockCount / 20),
        data: mockContentList,
      });
    });

    it('should handle service error gracefully', async () => {
      const error = new Error('Database failed');
      jest.spyOn(service, 'readAll').mockRejectedValue(error);

      await controller.fetchAll(mockReply as FastifyReply, 1, 20);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('findById', () => {
    const mockContent = {
      _id: '65e855cc75372f314360a601',
      contentId: 'a76b39f4-d9be-409e-85a1-33293582919e',
      collectionId: 'e0bdd73c-dd8b-4c2b-92cf-be753fd32c46',
      name: 'शब्द-4',
      contentType: 'Word',
      contentSourceData: [
        {
          language: 'hi',
          audioUrl: '',
          text: 'तेल',
          wordCount: 1,
          syllableCount: 2,
          meanOrthoComplexity: 0.2,
          totalOrthoComplexity: 0.4,
          meanPhonicComplexity: 4.95,
          totalPhonicComplexity: 9.9,
          meanComplexity: 10.3,
          wordMeasures: [
            {
              text: 'तेल',
              orthographic_complexity: 0.4,
              phonologic_complexity: 9.9,
            },
          ],
          wordFrequency: {
            तेल: 1,
          },
          syllableCountMap: {
            तेल: 2,
          },
          readingComplexity: 2.1,
        },
      ],
      imagePath: '',
      mechanics_data: [],
      level_complexity: {
        level: '',
        level_competency: '',
      },
      flaggedBy: '',
      lastFlaggedOn: '',
      flagReasons: '',
      reviewer: '',
      reviewStatus: '',
      status: 'live',
      publisher: 'ekstep',
      language: 'hi',
      contentIndex: 1,
      tags: [],
      createdAt: new Date('2024-02-29T12:55:30.791Z'),
      updatedAt: new Date('2024-02-29T12:55:30.791Z'),
    };

    it('should return content by ID', async () => {
      jest.spyOn(service, 'readById').mockResolvedValue(mockContent as any);

      await controller.findById(mockReply as FastifyReply, 'uuid-1234');

      expect(service.readById).toHaveBeenCalledWith('uuid-1234');
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        content: mockContent,
      });
    });
  });

  describe('update', () => {
    const contentId = 'abc123';
    const mockContentInput = {
      contentSourceData: [
        {
          text: 'तेल',
          language: 'hi',
        },
      ],
    };

    const mockUpdatedContent = {
      ...mockContentInput,
      contentId,
      contentSourceData: [
        {
          text: 'तेल',
          language: 'hi',
          wordCount: 1,
          syllableCount: 2,
          wordFrequency: { तेल: 1 },
          syllableCountMap: { तेल: 2 },
          wordMeasures: [
            {
              text: 'तेल',
              orthographic_complexity: 0.4,
              phonologic_complexity: 9.9,
            },
          ],
          readingComplexity: 2.1,
        },
      ] as [any],
    };

    it('should update content successfully', async () => {
      jest
        .spyOn(service, 'update')
        .mockResolvedValue(mockUpdatedContent as any);

      const mockAxiosResponse: AxiosResponse = {
        data: {
          result: {
            wordMeasures: {
              तेल: {
                orthographic_complexity: 0.4,
                phonologic_complexity: 9.9,
              },
            },
            readingComplexity: 2.1,
            wordFrequency: { तेल: 1 },
            syllableCountMap: { तेल: 2 },
            wordCount: 1,
            syllableCount: 2,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(of(mockAxiosResponse as AxiosResponse));

      await controller.update(mockReply as any, contentId, mockContentInput);

      expect(service.update).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockUpdatedContent,
      });
    });

    it('should handle error gracefully', async () => {
      const error = 'TypeError: Cannot read properties of undefined (reading \'pipe\')';
      jest.spyOn(service, 'update').mockRejectedValue(error);

      await controller.update(mockReply as any, contentId, mockContentInput);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  describe('delete', () => {
    const contentId = 'abc123';
    const mockDeletedResult = { acknowledged: true, deletedCount: 1 };

    it('should delete content by id successfully', async () => {
      jest.spyOn(service, 'delete').mockResolvedValue(mockDeletedResult);

      await controller.delete(mockReply as any, contentId);

      expect(service.delete).toHaveBeenCalledWith(contentId);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        deleted: mockDeletedResult,
      });
    });

    // it('should handle deletion error', async () => {
    //   const error = new Error('Deletion failed');
    //   jest.spyOn(service, 'delete').mockRejectedValue(error);

    //   await controller.delete(mockReply as any, contentId);

    //   expect(mockReply.status).toHaveBeenCalledWith(500);
    //   expect(mockReply.send).toHaveBeenCalledWith({
    //     status: 'error',
    //     message: 'Server error - ' + error,
    //   });
    // });
  });
});
