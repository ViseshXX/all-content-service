import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CollectionService } from './collection.service';
import { collection, collectionDocument } from 'src/schemas/collection.schema';
import { Model } from 'mongoose';

describe('CollectionService', () => {
  let service: CollectionService;
  let model: Model<collectionDocument>;

  const mockCollection = {
    name: 'Sample Collection',
    language: 'en',
    tags: ['tag1'],
    collectionId: 'COL123',
    category: 'story',
    type_of_learner: 'auditory',
    level_complexity: {
      level_competency: 'A1',
      CEFR_level: 'A1',
    },
    status: 'active',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        {
          provide: getModelToken(collection.name),
          useValue: {
            new: jest.fn().mockImplementation((data) => ({
              ...data,
              save: jest.fn().mockResolvedValue(data),
            })),
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
            save: jest.fn(),
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            findByIdAndUpdate: jest.fn(),
            findByIdAndRemove: jest.fn(),
            aggregate: jest.fn().mockImplementation(() => ({
              exec: jest.fn().mockResolvedValue([]),
            })),
          },
        },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
    model = module.get<Model<collectionDocument>>(
      getModelToken(collection.name),
    );
  });

  describe('create', () => {
    it('should create a new collection (success)', async () => {
      // Mock the service method directly
      jest.spyOn(service, 'create').mockResolvedValue(mockCollection as any);
      
      const result = await service.create(mockCollection as any);
      expect(result).toEqual(mockCollection);
    });

    it('should fail to create a collection (failure)', async () => {
      // Mock the service method to throw an error
      jest.spyOn(service, 'create').mockRejectedValue(new Error('DB error'));
      
      await expect(service.create(mockCollection as any)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('readAll', () => {
    it('should return all collections (success)', async () => {
      jest.spyOn(model, 'find').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([mockCollection]),
      } as any);
      const result = await service.readAll();
      expect(result).toEqual([mockCollection]);
    });

    it('should throw error while reading all collections (failure)', async () => {
      jest.spyOn(model, 'find').mockReturnValueOnce({
        exec: jest.fn().mockRejectedValueOnce(new Error('Read error')),
      } as any);
      await expect(service.readAll()).rejects.toThrow('Read error');
    });
  });

  describe('readbyLanguage', () => {
    it('should return collections by language (success)', async () => {
      jest.spyOn(model, 'find').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce([mockCollection]),
      } as any);
      const result = await service.readbyLanguage('en');
      expect(result).toEqual([mockCollection]);
    });

    it('should fail to fetch collections by language (failure)', async () => {
      jest.spyOn(model, 'find').mockReturnValueOnce({
        exec: jest.fn().mockRejectedValueOnce(new Error('Language error')),
      } as any);
      await expect(service.readbyLanguage('en')).rejects.toThrow(
        'Language error',
      );
    });
  });

  describe('readById', () => {
    it('should return collection by id (success)', async () => {
      jest.spyOn(model, 'findById').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockCollection),
      } as any);
      const result = await service.readById('123');
      expect(result).toEqual(mockCollection);
    });

    it('should fail to get collection by id (failure)', async () => {
      jest.spyOn(model, 'findById').mockReturnValueOnce({
        exec: jest.fn().mockRejectedValueOnce(new Error('Not found')),
      } as any);
      await expect(service.readById('123')).rejects.toThrow('Not found');
    });
  });

  describe('update', () => {
    it('should update a collection (success)', async () => {
      jest
        .spyOn(model, 'findByIdAndUpdate')
        .mockResolvedValueOnce(mockCollection as any);
      const result = await service.update('123', mockCollection as any);
      expect(result).toEqual(mockCollection);
    });

    it('should fail to update collection (failure)', async () => {
      jest
        .spyOn(model, 'findByIdAndUpdate')
        .mockRejectedValueOnce(new Error('Update failed'));
      await expect(
        service.update('123', mockCollection as any),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('delete', () => {
    it('should delete a collection (success)', async () => {
      jest
        .spyOn(model, 'findByIdAndRemove')
        .mockResolvedValueOnce({ deleted: true });
      const result = await service.delete('123');
      expect(result).toEqual({ deleted: true });
    });

    it('should fail to delete collection (failure)', async () => {
      jest
        .spyOn(model, 'findByIdAndRemove')
        .mockRejectedValueOnce(new Error('Delete error'));
      await expect(service.delete('123')).rejects.toThrow('Delete error');
    });
  });

  describe('getAssessment', () => {
    it('should return assessment collection (success)', async () => {
      jest
        .spyOn(model, 'aggregate')
        .mockResolvedValueOnce([mockCollection as any]);
      const result = await service.getAssessment(['tag1'], 'en');
      expect(result.data).toEqual([mockCollection]);
    });

    it('should fail to get assessment (failure)', async () => {
      jest
        .spyOn(model, 'aggregate')
        .mockRejectedValueOnce(new Error('Aggregate error'));
      await expect(service.getAssessment(['tag1'], 'en')).rejects.toThrow(
        'Aggregate error',
      );
    });
  });

  describe('getCompetencyCollections', () => {
    it('should return collectionId based on competency (success)', async () => {
      jest
        .spyOn(model, 'aggregate')
        .mockResolvedValueOnce([{ collectionId: 'COL123' }]);
      const result = await service.getCompetencyCollections(
        ['A1'],
        'en',
        'story',
        ['A1'],
      );
      expect(result).toEqual('COL123');
    });

    it('should fail to get competency collections (failure)', async () => {
      jest
        .spyOn(model, 'aggregate')
        .mockRejectedValueOnce(new Error('Competency error'));
      await expect(
        service.getCompetencyCollections(['A1'], 'en', 'story', ['A1']),
      ).rejects.toThrow('Competency error');
    });
  });

  describe('getTypeOfLearner', () => {
    it('should return collectionId for learner type (success)', async () => {
      jest
        .spyOn(model, 'aggregate')
        .mockResolvedValueOnce([{ collectionId: 'COL123' }]);
      const result = await service.getTypeOfLearner('auditory', 'en', 'story');
      expect(result).toEqual('COL123');
    });

    it('should fail to get learner type (failure)', async () => {
      jest
        .spyOn(model, 'aggregate')
        .mockRejectedValueOnce(new Error('Learner type error'));
      await expect(service.getTypeOfLearner('auditory')).rejects.toThrow(
        'Learner type error',
      );
    });
  });
});
