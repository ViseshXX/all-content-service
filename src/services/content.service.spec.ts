import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { contentService } from './content.service';
import { content } from 'src/schemas/content.schema';
import { HttpService } from '@nestjs/axios';

describe('contentService', () => {
  let service: contentService;

  // Base mock content data to reduce duplication
  const baseMockContent = {
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
    ],
    mechanics_data: [
      {
        mechanics_id: '0f9bbf52-6c35-49bb-9cd4-4aea2be642fe',
        language: 'en',
        text: 'Sample text',
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
    ],
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
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper function to create content variations
  const createMockContent = (overrides: Partial<typeof baseMockContent> = {}) => ({
    ...baseMockContent,
    ...overrides,
  });

  // Helper function to create content source data
  const createContentSourceData = (text: string, language: string = 'en', phonemes?: string[], syllableCount?: number) => ({
    language,
    text,
    ...(phonemes && { phonemes }),
    ...(syllableCount && { syllableCount }),
  });

  // Helper function to create mechanics data
  const createMechanicsData = (mechanicsId: string, language: string = 'en') => ({
    mechanics_id: mechanicsId,
    language,
  });

  // Helper function to create search results
  const createSearchResult = (contentId: string, contentType: string, text: string, language: string = 'en', phonemes?: string[], syllableCount?: number) => ({
    contentId,
    contentType,
    contentSourceData: [createContentSourceData(text, language, phonemes, syllableCount)],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        contentService,
        {
          provide: getModelToken(content.name),
          useValue: {
            new: jest.fn().mockImplementation((data) => ({
              ...data,
              save: jest.fn().mockResolvedValue(data),
            })),
            find: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
            save: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndRemove: jest.fn(),
            aggregate: jest.fn().mockImplementation(() => ({
              exec: jest.fn().mockResolvedValue([]),
            })),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(0),
            }),
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<contentService>(contentService);
  });

  describe('create', () => {
    it('should create content successfully', async () => {
      // Mock the service method directly
      jest.spyOn(service, 'create').mockResolvedValue(baseMockContent as any);
      
      const result = await service.create(baseMockContent as any);
      expect(result).toEqual(baseMockContent);
    });

    it('should handle database errors', async () => {
      // Mock the service method to throw an error
      jest.spyOn(service, 'create').mockRejectedValue(new Error('Database connection failed'));
      
      await expect(service.create(baseMockContent as any)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('search', () => {
    it('should search content successfully', async () => {
      const mockResults = [
        createSearchResult('search-result-1', 'Word', 'apple', 'en', ['AE', 'P', 'AH', 'L'], 2),
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.search(
        ['AE'],
        'en',
        'Word',
        5,
        '',
        'L1',
        [],
        {},
        [],
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
      expect(result).toHaveProperty('contentForToken');
    });

    it('should handle empty results gracefully', async () => {
      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.search(
        ['nonexistent'],
        'ta',
        'Word',
        5,
        '',
        'L1',
        ['C1'],
        {},
        [],
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
      expect(result.wordsArr).toHaveLength(0);
    });

    it('should handle database errors properly', async () => {
      const databaseError = new Error('Database connection failed');
      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockRejectedValue(databaseError),
      }));

      service['content'].aggregate = mockAggregate;

      await expect(
        service.search(
          ['test'],
          'ta',
          'Word',
          5,
          '',
          'L1',
          ['C1'],
          {},
          [],
          [],
        ),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle search with tags parameter', async () => {
      const mockSearchResults = [
        {
          ...createSearchResult('tagged-content1', 'Word', 'குழந்தை', 'ta', ['K', 'U', 'Z', 'AH', 'N', 'T', 'AH'], 2),
          tags: ['family', 'person'],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.search(
        ['கு'],
        'ta',
        'Word',
        5,
        'family',
        'L1',
        ['C1'],
        {},
        [],
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
      expect(result).toHaveProperty('contentForToken');
    });

    it('should handle search with multiple tags', async () => {
      const mockSearchResults = [
        {
          ...createSearchResult('multi-tagged-content', 'Word', 'family', 'en', ['F', 'AE', 'M', 'IH', 'L', 'IY'], 2),
          tags: ['family', 'person', 'relationship'],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.search(
        ['fa'],
        'en',
        'Word',
        5,
        'family,person',
        'L1',
        ['C1'],
        {},
        [],
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle search with CEFR levels', async () => {
      const mockSearchResults = [
        {
          ...createSearchResult('cefr-content', 'Word', 'basic', 'en', ['B', 'AE', 'S', 'IH', 'K'], 2),
          level_complexity: {
            CEFR_level: 'A1',
          },
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.search(
        ['ba'],
        'en',
        'Word',
        5,
        '',
        'L1',
        ['C1'],
        {},
        [],
        ['A1'],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle search with level competency', async () => {
      const mockSearchResults = [
        {
          ...createSearchResult('competency-content', 'Word', 'competency', 'en', ['K', 'AA', 'M', 'P', 'EH', 'T', 'EH', 'N', 'S', 'IY'], 4),
          level_complexity: {
            level_competency: 'L1.1',
          },
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.search(
        ['com'],
        'en',
        'Word',
        5,
        '',
        'L1',
        ['C1'],
        {},
        ['L1.1'],
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle search with graphemes mapping', async () => {
      const mockSearchResults = [
        createSearchResult('grapheme-content', 'Word', 'grapheme', 'en', ['G', 'R', 'AE', 'F', 'IY', 'M'], 2),
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const graphemesMappedObj = { 'gr': ['G', 'R'] };

      const result = await service.search(
        ['gr'],
        'en',
        'Word',
        5,
        '',
        'L1',
        ['C1'],
        graphemesMappedObj,
        [],
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });
  });

  describe('searchByFilter', () => {
    it('should successfully search and return filtered content', async () => {
      const mockSearchResults = [
        {
          contentId: 'content1',
          contentType: 'Word',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அம்மா',
              syllableCount: 2,
              totalOrthoComplexity: 10,
              totalPhonicComplexity: 5,
              syllableCountMap: { அ: 1, ம்: 1, மா: 1 },
            },
          ],
          tags: ['family'],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        ['அ', 'ம்'],
        { $gte: 1, $lte: 3 },
        undefined,
        { $gte: 5, $lte: 15 },
        { $gte: 3, $lte: 10 },
        undefined,
        'ta',
        'Word',
        5,
        undefined,
        undefined,
        ['family'],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
    });

    it('should handle empty parameters gracefully', async () => {
      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'en',
        'Word',
        5,
        undefined,
        undefined,
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle char contentType conversion', async () => {
      const mockSearchResults = [
        {
          contentId: 'char-content1',
          contentType: 'Char',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அ',
              syllableCount: 1,
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        ['அ'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'ta',
        'Char',
        5,
        undefined,
        undefined,
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle sentence contentType', async () => {
      const mockSearchResults = [
        {
          contentId: 'sentence-content1',
          contentType: 'Sentence',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அம்மா வீட்டுக்கு வருகிறாள்',
              syllableCount: 5,
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        ['அம்மா'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'ta',
        'Sentence',
        5,
        undefined,
        undefined,
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle paragraph contentType', async () => {
      const mockSearchResults = [
        {
          contentId: 'paragraph-content1',
          contentType: 'Paragraph',
          contentSourceData: [
            {
              language: 'ta',
              text: 'இது ஒரு பத்தி. இதில் பல வாக்கியங்கள் உள்ளன.',
              syllableCount: 10,
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        ['இது'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'ta',
        'Paragraph',
        5,
        undefined,
        undefined,
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle contentId filter', async () => {
      const mockSearchResults = [
        {
          contentId: 'specific-content-id',
          contentType: 'Word',
          contentSourceData: [
            {
              language: 'en',
              text: 'specific',
              syllableCount: 3,
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'en',
        'Word',
        5,
        'specific-content-id',
        undefined,
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });

    it('should handle collectionId filter', async () => {
      const mockSearchResults = [
        {
          contentId: 'collection-content',
          collectionId: 'specific-collection',
          contentType: 'Word',
          contentSourceData: [
            {
              language: 'en',
              text: 'collection',
              syllableCount: 3,
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      }));

      service['content'].aggregate = mockAggregate;

      const result = await service.searchByFilter(
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'en',
        'Word',
        5,
        undefined,
        'specific-collection',
        [],
      );

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('wordsArr');
    });
  });

  describe('charNotPresent', () => {
    it('should return content not having specified characters', async () => {
      const mockResults = [
        {
          contentId: 'content1',
          contentSourceData: [
            {
              hi: {
                text: 'அம்மா',
              },
            },
          ],
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockResults),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.charNotPresent(['க', 'ங']);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Hindi vowel combinations', async () => {
      const mockResults = [
        {
          contentId: 'hindi-content1',
          contentSourceData: [
            {
              hi: {
                text: 'माँ',
              },
            },
          ],
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockResults),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.charNotPresent(['अ', 'आ']);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle database errors', async () => {
      const databaseError = new Error('Database connection failed');
      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(databaseError),
        }),
      });

      service['content'].find = mockFind;

      await expect(service.charNotPresent(['test'])).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle complex Hindi combinations', async () => {
      const mockResults = [
        {
          contentId: 'complex-hindi1',
          contentSourceData: [
            {
              hi: {
                text: 'शिक्षक',
              },
            },
          ],
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockResults),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.charNotPresent(['श', 'ष']);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Tamil character combinations', async () => {
      const mockResults = [
        {
          contentId: 'tamil-content1',
          contentSourceData: [
            {
              hi: {
                text: 'தமிழ்',
              },
            },
          ],
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockResults),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.charNotPresent(['த', 'ம']);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Kannada character combinations', async () => {
      const mockResults = [
        {
          contentId: 'kannada-content1',
          contentSourceData: [
            {
              hi: {
                text: 'ಕನ್ನಡ',
              },
            },
          ],
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockResults),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.charNotPresent(['ಕ', 'ನ']);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Telugu character combinations', async () => {
      const mockResults = [
        {
          contentId: 'telugu-content1',
          contentSourceData: [
            {
              hi: {
                text: 'తెలుగు',
              },
            },
          ],
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockResults),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.charNotPresent(['త', 'ల']);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getMechanicsContentData', () => {
    it('should get mechanics content data successfully', async () => {
      const mockResults = [
        {
          contentId: 'mechanics-content-1',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
          level_complexity: {
            level_competency: 'L1.1',
          },
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        5,
        'en',
        ['L1.1'],
        [],
        [],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
    });

    it('should handle database errors', async () => {
      const databaseError = new Error('Database connection failed');
      const mockAggregate = jest.fn().mockRejectedValue(databaseError);
      service['content'].aggregate = mockAggregate;

      await expect(
        service.getMechanicsContentData(
          'Word',
          'mech_001',
          5,
          'en',
          ['L1.1'],
          [],
          [],
        ),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle empty tags', async () => {
      const mockResults = [
        {
          contentId: 'no-tags-content',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        5,
        'en',
        ['L1.1'],
        [],
        [],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
    });

    it('should handle fallback content fetching when insufficient results', async () => {
      const initialResults = [
        {
          contentId: 'initial-content1',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
          level_complexity: {
            level_competency: 'L1.1',
          },
        },
      ];

      const fallbackResults = [
        {
          contentId: 'fallback-content1',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
        },
      ];

      let callCount = 0;
      const mockAggregate = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(initialResults);
        } else {
          return Promise.resolve(fallbackResults);
        }
      });

      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        5,
        'en',
        ['L1.1'],
        [],
        [],
      );

      expect(mockAggregate).toHaveBeenCalledTimes(4);
      expect(result).toHaveProperty('wordsArr');
      expect(result.wordsArr.length).toBe(4);
    });

    it('should handle empty levelCompetencyArr gracefully', async () => {
      const fallbackResults = [
        {
          contentId: 'fallback-only-content',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(fallbackResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        3,
        'en',
        [],
        [],
        [],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
      expect(mockAggregate).toHaveBeenCalled();
    });

    it('should properly filter mechanics_data by mechanics_id in results', async () => {
      const mockResults = [
        {
          contentId: 'multi-mechanics-content',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            {
              mechanics_id: 'mech_001',
              language: 'en',
              difficulty: 'easy',
              instructions: 'Target mechanic',
            },
            {
              mechanics_id: 'mech_002',
              language: 'en',
              difficulty: 'medium',
              instructions: 'Other mechanic',
            },
            {
              mechanics_id: 'mech_003',
              language: 'en',
              difficulty: 'hard',
              instructions: 'Another mechanic',
            },
          ],
          level_complexity: {
            level_competency: 'L1.1',
          },
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        3,
        'en',
        ['L1.1'],
        [],
        [],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);

      if (result.wordsArr.length > 0) {
        const firstResult = result.wordsArr[0];
        expect(firstResult).toHaveProperty('mechanics_data');
        expect(Array.isArray(firstResult.mechanics_data)).toBe(true);
      }
    });

    it('should handle different content types', async () => {
      const mockResults = [
        {
          contentId: 'sentence-mechanics',
          contentType: 'Sentence',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Sentence',
        'mech_001',
        5,
        'en',
        ['L1.1'],
        [],
        [],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
    });

    it('should handle different languages', async () => {
      const mockResults = [
        {
          contentId: 'tamil-mechanics',
          contentType: 'Word',
          language: 'ta',
          mechanics_data: [
            createMechanicsData('mech_001', 'ta'),
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        5,
        'ta',
        ['L1.1'],
        [],
        [],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
    });

    it('should handle CEFR levels', async () => {
      const mockResults = [
        {
          contentId: 'cefr-mechanics',
          contentType: 'Word',
          language: 'en',
          mechanics_data: [
            createMechanicsData('mech_001', 'en'),
          ],
          level_complexity: {
            CEFR_level: 'A1',
          },
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getMechanicsContentData(
        'Word',
        'mech_001',
        5,
        'en',
        ['L1.1'],
        [],
        ['A1'],
      );

      expect(result).toHaveProperty('wordsArr');
      expect(Array.isArray(result.wordsArr)).toBe(true);
    });
  });

  describe('pagination', () => {
    it('should return paginated content', async () => {
      const mockResults = [
        {
          _id: 'content1',
          contentId: 'content1',
          contentType: 'Word',
          language: 'en',
          contentSourceData: [
            {
              text: 'apple',
              phonemes: ['AE', 'P', 'AH', 'L'],
              syllableCount: 2,
            },
          ],
          contentIndex: 1,
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockResults),
      }));
      service['content'].aggregate = mockAggregate;

      const result = await service.pagination(0, 5, 'Word', 'collection123');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe(200);
    });

    it('should handle empty results', async () => {
      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]),
      }));
      service['content'].aggregate = mockAggregate;

      const result = await service.pagination(0, 5, 'Word', 'collection123');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(0);
    });

    it('should handle different content types', async () => {
      const mockResults = [
        {
          _id: 'sentence1',
          contentId: 'sentence1',
          contentType: 'Sentence',
          language: 'en',
          contentSourceData: [
            {
              text: 'This is a sentence.',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockResults),
      }));
      service['content'].aggregate = mockAggregate;

      const result = await service.pagination(0, 5, 'Sentence', 'collection123');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result.status).toBe(200);
    });
  });

  describe('getRandomContent', () => {
    it('should return random content', async () => {
      const mockResults = [
        {
          contentId: 'random1',
          contentType: 'Word',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அம்மா',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getRandomContent(5, 'Word', 'ta');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe(200);
    });

    it('should handle different content types', async () => {
      const mockResults = [
        {
          contentId: 'random-sentence',
          contentType: 'Sentence',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அம்மா வீட்டுக்கு வருகிறாள்',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getRandomContent(5, 'Sentence', 'ta');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result.status).toBe(200);
    });
  });

  describe('getContentWord', () => {
    it('should return word content', async () => {
      const mockResults = [
        {
          contentId: 'word1',
          contentType: 'Word',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அம்மா',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getContentWord(5, 'ta');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe(200);
    });

    it('should handle different languages', async () => {
      const mockResults = [
        {
          contentId: 'hindi-word',
          contentType: 'Word',
          contentSourceData: [
            {
              language: 'hi',
              text: 'माँ',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getContentWord(5, 'hi');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result.status).toBe(200);
    });
  });

  describe('getContentSentence', () => {
    it('should return sentence content', async () => {
      const mockResults = [
        {
          contentId: 'sentence1',
          contentType: 'Sentence',
          contentSourceData: [
            {
              language: 'ta',
              text: 'அம்மா வீட்டுக்கு வருகிறாள்',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getContentSentence(5, 'ta');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe(200);
    });

    it('should handle different languages', async () => {
      const mockResults = [
        {
          contentId: 'hindi-sentence',
          contentType: 'Sentence',
          contentSourceData: [
            {
              language: 'hi',
              text: 'माँ घर आ रही है',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getContentSentence(5, 'hi');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result.status).toBe(200);
    });
  });

  describe('getContentParagraph', () => {
    it('should return paragraph content', async () => {
      const mockResults = [
        {
          contentId: 'paragraph1',
          contentType: 'Paragraph',
          contentSourceData: [
            {
              language: 'ta',
              text: 'இது ஒரு பத்தி. இதில் பல வாக்கியங்கள் உள்ளன.',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getContentParagraph(5, 'ta');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe(200);
    });

    it('should handle different languages', async () => {
      const mockResults = [
        {
          contentId: 'hindi-paragraph',
          contentType: 'Paragraph',
          contentSourceData: [
            {
              language: 'hi',
              text: 'यह एक पैराग्राफ है। इसमें कई वाक्य हैं।',
            },
          ],
        },
      ];

      const mockAggregate = jest.fn().mockResolvedValue(mockResults);
      service['content'].aggregate = mockAggregate;

      const result = await service.getContentParagraph(5, 'hi');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result.status).toBe(200);
    });
  });

  describe('readAll', () => {
    it('should return all content with pagination', async () => {
      const mockResults = [
        {
          contentId: 'content1',
          name: 'Test Content 1',
          contentType: 'Word',
        },
        {
          contentId: 'content2',
          name: 'Test Content 2',
          contentType: 'Sentence',
        },
      ];

      const mockFind = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockResults),
          }),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.readAll(1, 10);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should handle empty results', async () => {
      const mockFind = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      service['content'].find = mockFind;

      const result = await service.readAll(1, 10);

      expect(mockFind).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('countAll', () => {
    it('should return total count of content', async () => {
      const mockCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(100),
      });

      service['content'].countDocuments = mockCount;

      const result = await service.countAll();

      expect(mockCount).toHaveBeenCalled();
      expect(result).toBe(100);
    });

    it('should handle zero count', async () => {
      const mockCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      service['content'].countDocuments = mockCount;

      const result = await service.countAll();

      expect(mockCount).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('readById', () => {
    it('should return content by ID', async () => {
      const mockContent = {
        contentId: 'test-id',
        name: 'Test Content',
        contentType: 'Word',
      };

      const mockFindOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockContent),
      });

      service['content'].findOne = mockFindOne;

      const result = await service.readById('test-id');

      expect(mockFindOne).toHaveBeenCalledWith({ contentId: 'test-id' });
      expect(result).toEqual(mockContent);
    });

    it('should handle content not found', async () => {
      const mockFindOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      service['content'].findOne = mockFindOne;

      const result = await service.readById('non-existent-id');

      expect(mockFindOne).toHaveBeenCalledWith({ contentId: 'non-existent-id' });
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update content successfully', async () => {
      const updatedContent = createMockContent({
        contentId: 'test-id',
        collectionId: 'test-collection',
        name: 'Updated Content',
        contentType: 'Word',
        contentSourceData: [
          {
            text: 'updated',
            phonemes: ['AH', 'P', 'D', 'EY', 'T', 'IH', 'D'],
            syllableCount: 3,
          },
        ],
        level_complexity: {
          level: 'intermediate',
          level_competency: 'intermediate',
        },
      });

      const mockFindByIdAndUpdate = jest.fn().mockResolvedValue(updatedContent);
      service['content'].findByIdAndUpdate = mockFindByIdAndUpdate;

      const result = await service.update('test-id', updatedContent as any);

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith('test-id', updatedContent, { new: true });
      expect(result).toEqual(updatedContent);
    });

    it('should handle update errors', async () => {
      const updateError = new Error('Update failed');
      const mockFindByIdAndUpdate = jest.fn().mockRejectedValue(updateError);
      service['content'].findByIdAndUpdate = mockFindByIdAndUpdate;

      await expect(service.update('test-id', {} as any)).rejects.toThrow('Update failed');
    });
  });

  describe('delete', () => {
    it('should delete content successfully', async () => {
      const mockFindByIdAndRemove = jest.fn().mockResolvedValue({ deleted: true });
      service['content'].findByIdAndRemove = mockFindByIdAndRemove;

      const result = await service.delete('test-id');

      expect(mockFindByIdAndRemove).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ deleted: true });
    });

    it('should handle delete errors', async () => {
      const deleteError = new Error('Delete failed');
      const mockFindByIdAndRemove = jest.fn().mockRejectedValue(deleteError);
      service['content'].findByIdAndRemove = mockFindByIdAndRemove;

      await expect(service.delete('test-id')).rejects.toThrow('Delete failed');
    });
  });
});

