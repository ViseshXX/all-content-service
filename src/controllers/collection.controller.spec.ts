import { Test, TestingModule } from '@nestjs/testing';
import { CollectionController } from './collection.controller';
import { CollectionService } from '../services/collection.service';
import { FastifyReply } from 'fastify';
import { HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';

describe('CollectionController', () => {
  let controller: CollectionController;
  let service: CollectionService;

  const mockReply: Partial<FastifyReply> = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionController],
      providers: [
        {
          provide: CollectionService,
          useValue: {
            create: jest.fn(),
            readAll: jest.fn(),
            readbyLanguage: jest.fn(),
            readById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CollectionController);
    service = module.get(CollectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- Test: POST /collection ----------
  describe('create', () => {
    const requestBody = {
      collectionId: '94312c93-5bb8-4144-8822-9a61ad1cd5a8',
      name: 'எழுத்துக்கள்',
      description: 'ASAR Set எழுத்துக்கள்',
      category: 'Char',
      author: 'ASER',
      publisher: 'NCERT',
      edition: '1st',
      imagePath: '/images/ezhuthu.png',
      language: 'ta',
      difficultyLevel: 'easy',
      status: 'live',
      ageGroup: '5-8',
      flaggedBy: 'admin',
      lastFlaggedOn: '2024-06-01T10:00:00.000Z',
      flagReasons: 'Content quality',
      reviewer: 'QA_Team',
      reviewStatus: 'approved',
      level_complexity: {
        level: 'Level 1',
        level_competency: 'M0',
        CEFR_level: 'A1',
      },
      tags: ['ASER'] as [string], // Tuple with one item
      createdAt: new Date('2024-06-01T10:00:00.000Z'),
      updatedAt: new Date('2024-06-01T10:00:00.000Z'),
    };

    const createdResponse = {
      collectionId: '94312c93-5bb8-4144-8822-9a61ad1cd5a8',
      name: 'எழுத்துக்கள்',
      description: 'ASAR Set எழுத்துக்கள்',
      category: 'Char',
      author: 'ASER',
      publisher: 'NCERT',
      edition: '1st',
      imagePath: '/images/ezhuthu.png',
      language: 'ta',
      difficultyLevel: 'easy',
      status: 'live',
      ageGroup: '5-8',
      flaggedBy: 'admin',
      lastFlaggedOn: '2024-06-01T10:00:00.000Z',
      flagReasons: 'Content quality',
      reviewer: 'QA_Team',
      reviewStatus: 'approved',
      level_complexity: {
        level: 'Level 1',
        level_competency: 'M0',
        CEFR_level: 'A1',
      },
      tags: ['ASER'] as [string], // Tuple with one item
      createdAt: new Date('2024-06-01T10:00:00.000Z'),
      updatedAt: new Date('2024-06-01T10:00:00.000Z'),
    };

    it('should create a new collection and return it', async () => {
      jest
        .spyOn(service, 'create')
        .mockImplementation(() => Promise.resolve(createdResponse));

      await controller.create(mockReply as FastifyReply, requestBody);

      expect(service.create).toHaveBeenCalledWith(requestBody);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: createdResponse,
      });
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('DB Insert Failed');
      jest.spyOn(service, 'create').mockRejectedValue(error);

      await controller.create(mockReply as FastifyReply, requestBody);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  // ---------- Test: GET /collection ----------
  describe('fatchAll', () => {
    const mockCollections = [
      {
        _id: '665ef5896e1219eb3d1a9b21',
        collectionId: '58009c39-fd86-45a5-bc32-9638a8198521',
        name: 'Teacher-Teacher',
        description: 'Teacher-Teacher',
        category: 'Word',
        author: 'Ekstep',
        publisher: 'NCERT',
        edition: '1st',
        imagePath: '/images/book.png',
        language: 'kn',
        difficultyLevel: 'beginner',
        status: 'live',
        ageGroup: '6-8',
        flaggedBy: 'moderator',
        lastFlaggedOn: '2024-06-01T10:00:00.000Z',
        flagReasons: 'Offensive content',
        reviewer: 'admin',
        reviewStatus: 'approved',
        level_complexity: {
          level: 'Level 1',
          level_competency: 'm0',
          CEFR_level: 'A1',
        },
        tags: ['ASER'] as [string], // ✅ use `string[]` only if `tags` is defined as `string[]` in the model
        createdAt: new Date('2024-06-04T11:07:02.300Z'),
        updatedAt: new Date('2024-06-04T11:07:02.300Z'),
      },
    ];

    it('should return all collections', async () => {
      jest
        .spyOn(service, 'readAll')
        .mockImplementation(() => Promise.resolve(mockCollections));

      await controller.fatchAll(mockReply as FastifyReply);

      expect(service.readAll).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockCollections,
      });
    });

    it('should return 500 if service fails', async () => {
      const error = new Error('DB readAll error');
      jest.spyOn(service, 'readAll').mockRejectedValue(error);

      await controller.fatchAll(mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'error',
        message: 'Server error - ' + error,
      });
    });
  });

  // ---------- Test: GET /collection ----------
  describe('fatchByLanguage', () => {
    const language = 'kn';

    const mockCollections = [
      {
        _id: '665ef5896e1219eb3d1a9b21',
        collectionId: '58009c39-fd86-45a5-bc32-9638a8198521',
        name: 'Teacher-Teacher',
        description: 'Teacher-Teacher',
        category: 'Word',
        author: 'Ekstep',
        publisher: 'NCERT',
        edition: '1st',
        imagePath: '/images/book.png',
        language: 'kn',
        difficultyLevel: 'beginner',
        status: 'live',
        ageGroup: '6-8',
        flaggedBy: 'moderator',
        lastFlaggedOn: '2024-06-01T10:00:00.000Z',
        flagReasons: 'Offensive content',
        reviewer: 'admin',
        reviewStatus: 'approved',
        level_complexity: {
          level: 'Level 1',
          level_competency: 'm0',
          CEFR_level: 'A1',
        },
        tags: ['ASER'] as [string],
        createdAt: new Date('2024-06-04T11:07:02.300Z'),
        updatedAt: new Date('2024-06-04T11:07:02.300Z'),
        __v: 0,
      },
    ];

    it('should return collections filtered by language', async () => {
      jest.spyOn(service, 'readbyLanguage').mockResolvedValue(mockCollections);

      await controller.fatchByLanguage(mockReply as FastifyReply, language);

      expect(service.readbyLanguage).toHaveBeenCalledWith(language);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'success',
        data: mockCollections,
      });
    });

    it('should return 500 if service fails', async () => {
      const error = new Error('DB error');
      jest.spyOn(service, 'readbyLanguage').mockRejectedValue(error);

      await controller.fatchByLanguage(mockReply as FastifyReply, language);

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
    const mockId = '6662a5848946f51e15abb9fd';

    const mockCollection = {
      _id: '6662a5848946f51e15abb9fd',
      collectionId: '7b762891-8337-46a6-8eb0-abfcdc5c7f35',
      name: 'Teacher-Teacher',
      description: 'Teacher-Teacher',
      category: 'Word',
      author: 'Ekstep',
      publisher: 'NCERT',
      edition: '1st',
      imagePath: '/images/book.png',
      language: 'kn',
      difficultyLevel: 'easy',
      status: 'live',
      ageGroup: '6-8',
      flaggedBy: 'moderator',
      lastFlaggedOn: '2024-06-07T06:14:44.161Z',
      flagReasons: 'Quality issue',
      reviewer: 'QA_Team',
      reviewStatus: 'approved',
      level_complexity: {
        level: 'Level 1',
        level_competency: 'M0',
        CEFR_level: 'A1',
      },
      tags: ['ASER'] as [string], // Tuple with one item
      createdAt: new Date('2024-06-07T06:14:44.161Z'),
      updatedAt: new Date('2024-06-07T06:14:44.161Z'),
      __v: 0,
    };

    it('should return collection by ID', async () => {
      jest.spyOn(service, 'readById').mockResolvedValue(mockCollection);

      await controller.findById(mockReply as FastifyReply, mockId);

      expect(service.readById).toHaveBeenCalledWith(mockId);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        collection: mockCollection,
      });
    });

  });

  describe('update', () => {
    const mockId = '94312c93-5bb8-4144-8822-9a61ad1cd5a8';

    const updatePayload = {
      _id: '6662a5848946f51e15abb9fd',
      collectionId: '7b762891-8337-46a6-8eb0-abfcdc5c7f35',
      name: 'Teacher-Teacher',
      description: 'Teacher-Teacher',
      category: 'Word',
      author: 'Ekstep',
      publisher: 'NCERT',
      edition: '1st',
      imagePath: '/images/book.png',
      language: 'kn',
      difficultyLevel: 'easy',
      status: 'live',
      ageGroup: '6-8',
      flaggedBy: 'moderator',
      lastFlaggedOn: '2024-06-07T06:14:44.161Z',
      flagReasons: 'Quality issue',
      reviewer: 'QA_Team',
      reviewStatus: 'approved',
      level_complexity: {
        level: 'Level 1',
        level_competency: 'M0',
        CEFR_level: 'A1',
      },
      tags: ['ASER'] as [string], // Tuple with one item
      createdAt: new Date('2024-06-07T06:14:44.161Z'),
      updatedAt: new Date('2024-06-07T06:14:44.161Z'),
      __v: 0,
    };

    const updatedCollection = {
      ...updatePayload,
      _id: '6662a5848946f51e15abb9fd',
    };

    it('should update the collection and return updated result', async () => {
      jest.spyOn(service, 'update').mockResolvedValue(updatedCollection);

      await controller.update(mockReply as FastifyReply, mockId, updatePayload);

      expect(service.update).toHaveBeenCalledWith(mockId, updatePayload);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        updated: updatedCollection,
      });
    });

  });

  describe('delete', () => {
    const mockId = '94312c93-5bb8-4144-8822-9a61ad1cd5a8';

    const mockDeletedResponse = {
      acknowledged: true,
      deletedCount: 1,
    };

    it('should delete the collection and return confirmation', async () => {
      jest.spyOn(service, 'delete').mockResolvedValue(mockDeletedResponse);

      await controller.delete(mockReply as FastifyReply, mockId);

      expect(service.delete).toHaveBeenCalledWith(mockId);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockReply.send).toHaveBeenCalledWith({
        deleted: mockDeletedResponse,
      });
    });
  });
});
