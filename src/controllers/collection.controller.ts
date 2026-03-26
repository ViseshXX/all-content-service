import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { collection } from 'src/schemas/collection.schema';
import { CollectionService } from 'src/services/collection.service';
import { FastifyReply } from 'fastify';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import {
  ResourceNotFoundException,
  ValidationException,
} from 'src/common/exceptions/api.exceptions';
import { Types } from 'mongoose';

@ApiTags('collection')
@ApiBearerAuth('access-token')
@Controller('collection')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(private readonly CollectionService: CollectionService) {}

  @ApiOperation({
    summary: 'Create a new collection',
    description:
      'Create a new collection to organize content items. Collections can be used to group words, sentences, paragraphs, or other content types by language, author, or category.',
  })
  @ApiBody({
    description: 'Request body for creating a new collection',
    schema: {
      type: 'object',
      required: ['name', 'category', 'language'],
      properties: {
        name: {
          type: 'string',
          example: 'Teacher-Teacher',
          description: 'Name of the collection',
        },
        description: {
          type: 'string',
          example: 'Teacher-Teacher',
          description: 'Description of the collection',
        },
        category: {
          type: 'string',
          example: 'Word',
          description: 'Category of content (Word, Sentence, Paragraph, Char)',
        },
        author: {
          type: 'string',
          example: 'Ekstep',
          description: 'Author or publisher of the collection',
        },
        language: {
          type: 'string',
          example: 'kn',
          description: 'Language code (en, hi, ta, kn, te, gu)',
        },
        status: {
          type: 'string',
          example: 'live',
          description: 'Status of the collection (live, draft)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['ASER', 'set1'],
          description: 'Tags for filtering and categorization',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Collection created successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Teacher-Teacher' },
            description: { type: 'string', example: 'Teacher-Teacher' },
            category: { type: 'string', example: 'Word' },
            author: { type: 'string', example: 'Ekstep' },
            language: { type: 'string', example: 'kn' },
            status: { type: 'string', example: 'live' },
            tags: { type: 'array', items: { type: 'string' }, example: [] },
            createdAt: { type: 'string', format: 'date-time', example: '2024-06-07T06:14:44.161Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2024-06-07T06:14:44.161Z' },
            _id: { type: 'string', example: '6662a5848946f51e15abb9fd' },
            collectionId: {
              type: 'string',
              format: 'uuid',
              example: '7b762891-8337-46a6-8eb0-abfcdc5c7f35',
            },
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
  async create(@Res() response: FastifyReply, @Body() collection: collection) {
    try {
      const newCollection = await this.CollectionService.create(collection);
      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: newCollection,
      });
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get all collections',
    description: 'Retrieve a list of all collections in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'Collections retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '665ef5896e1219eb3d1a9b21' },
              name: { type: 'string', example: 'Teacher-Teacher' },
              description: { type: 'string', example: 'Teacher-Teacher' },
              category: { type: 'string', example: 'Word' },
              author: { type: 'string', example: 'Ekstep' },
              language: { type: 'string', example: 'kn' },
              status: { type: 'string', example: 'live' },
              tags: { type: 'array', items: { type: 'string' }, example: [] },
              createdAt: { type: 'string', format: 'date-time', example: '2024-06-04T11:07:02.300Z' },
              updatedAt: { type: 'string', format: 'date-time', example: '2024-06-04T11:07:02.300Z' },
              collectionId: { type: 'string', format: 'uuid', example: '58009c39-fd86-45a5-bc32-9638a8198521' },
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
  @Get()
  async fatchAll(@Res() response: FastifyReply) {
    try {
      const data = await this.CollectionService.readAll();
      return response.status(HttpStatus.OK).send({ status: 'success', data });
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get collections by language',
    description: 'Retrieve all collections filtered by a specific language code',
  })
  @ApiParam({
    name: 'language',
    description: 'Language code to filter collections (e.g., en, hi, ta, kn, te, gu)',
    example: 'ta',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Collections retrieved successfully for the specified language',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '665ef5896e1219eb3d1a9b21' },
              name: { type: 'string', example: 'Teacher-Teacher' },
              description: { type: 'string', example: 'Teacher-Teacher' },
              category: { type: 'string', example: 'Word' },
              author: { type: 'string', example: 'Ekstep' },
              language: { type: 'string', example: 'ta' },
              status: { type: 'string', example: 'live' },
              tags: { type: 'array', items: { type: 'string' }, example: [] },
              createdAt: { type: 'string', format: 'date-time', example: '2024-06-04T11:07:02.300Z' },
              updatedAt: { type: 'string', format: 'date-time', example: '2024-06-04T11:07:02.300Z' },
              collectionId: { type: 'string', format: 'uuid', example: '58009c39-fd86-45a5-bc32-9638a8198521' },
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
  @Get('/bylanguage/:language')
  async fatchByLanguage(
    @Res() response: FastifyReply,
    @Param('language') language,
  ) {
    try {
      if (!language) {
        throw new ValidationException('language is required.');
      }
      const data = await this.CollectionService.readbyLanguage(language);
      return response.status(HttpStatus.OK).send({ status: 'success', data });
    } catch (error) {
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get collection by ID',
    description: 'Retrieve a specific collection by its MongoDB ObjectId',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the collection',
    example: '65717aea18da2cbda941cee2',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        collection: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '6662a5848946f51e15abb9fd' },
            name: { type: 'string', example: 'Teacher-Teacher' },
            description: { type: 'string', example: 'Teacher-Teacher' },
            category: { type: 'string', example: 'Word' },
            author: { type: 'string', example: 'Ekstep' },
            language: { type: 'string', example: 'kn' },
            status: { type: 'string', example: 'live' },
            tags: { type: 'array', items: { type: 'string' }, example: ['ASR'] },
            createdAt: { type: 'string', format: 'date-time', example: '2024-06-07T06:14:44.161Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2024-06-07T06:14:44.161Z' },
            collectionId: { type: 'string', format: 'uuid', example: '7b762891-8337-46a6-8eb0-abfcdc5c7f35' },
            __v: { type: 'number', example: 0 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 404,
    description: 'Collection not found',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Collection not found' },
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
  @Get('/:id')
  async findById(@Res() response: FastifyReply, @Param('id') id) {
    if (!id) {
      throw new ValidationException('id is required.');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new ResourceNotFoundException('Collection not found.');
    }
    const collection = await this.CollectionService.readById(id);
    if (!collection) {
      throw new ResourceNotFoundException('Collection not found.');
    }
    return response.status(HttpStatus.OK).send({
      collection,
    });
  }

  @ApiOperation({
    summary: 'Update a collection',
    description: 'Update an existing collection by its MongoDB ObjectId',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the collection to update',
    example: '65717aea18da2cbda941cee2',
    required: true,
  })
  @ApiBody({
    description: 'Updated collection data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'எழுத்துக்கள்', description: 'Updated name of the collection' },
        description: { type: 'string', example: 'ASAR Set எழுத்துக்கள்', description: 'Updated description' },
        category: { type: 'string', example: 'Char', description: 'Category type (Word, Sentence, Paragraph, Char)' },
        author: { type: 'string', example: 'ASER', description: 'Author or publisher' },
        language: { type: 'string', example: 'ta', description: 'Language code' },
        status: { type: 'string', example: 'live', description: 'Status (live, draft)' },
        tags: { type: 'array', items: { type: 'string' }, example: ['ASER', 'set1', 'm1'], description: 'Tags for filtering' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Collection updated successfully',
    schema: {
      type: 'object',
      properties: {
        updated: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '6662a5848946f51e15abb9fd' },
            name: { type: 'string', example: 'எழுத்துக்கள்' },
            description: { type: 'string', example: 'ASAR Set எழுத்துக்கள்' },
            category: { type: 'string', example: 'Char' },
            author: { type: 'string', example: 'ASER' },
            language: { type: 'string', example: 'ta' },
            status: { type: 'string', example: 'live' },
            tags: { type: 'array', items: { type: 'string' }, example: ['ASER', 'set1', 'm1'] },
            createdAt: { type: 'string', format: 'date-time', example: '2024-06-07T06:14:44.161Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2024-06-07T06:14:44.161Z' },
            collectionId: { type: 'string', format: 'uuid', example: '7b762891-8337-46a6-8eb0-abfcdc5c7f35' },
            __v: { type: 'number', example: 0 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 404,
    description: 'Collection not found',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Collection not found' },
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
  @Put('/:id')
  async update(
    @Res() response: FastifyReply,
    @Param('id') id,
    @Body() collection: collection,
  ) {
    if (!id) {
      throw new ValidationException('id is required.');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new ResourceNotFoundException('Collection not found for update.');
    }
    const updated = await this.CollectionService.update(id, collection);
    if (!updated) {
      throw new ResourceNotFoundException('Collection not found for update.');
    }
    return response.status(HttpStatus.OK).send({
      updated,
    });
  }

  @ApiOperation({
    summary: 'Delete a collection',
    description: 'Delete an existing collection by its MongoDB ObjectId. This will permanently remove the collection.',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the collection to delete',
    example: '65717aea18da2cbda941cee2',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Collection deleted successfully',
    schema: {
      type: 'object',
      properties: {
        deleted: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '6662a5848946f51e15abb9fd' },
            name: { type: 'string', example: 'எழுத்துக்கள்' },
            description: { type: 'string', example: 'ASAR Set எழுத்துக்கள்' },
            category: { type: 'string', example: 'Char' },
            author: { type: 'string', example: 'ASER' },
            language: { type: 'string', example: 'kn' },
            status: { type: 'string', example: 'live' },
            tags: { type: 'array', items: { type: 'string' }, example: ['ASER', 'set1', 'm1'] },
            createdAt: { type: 'string', format: 'date-time', example: '2023-12-18T10:53:49.787Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2023-12-18T10:53:49.788Z' },
            collectionId: { type: 'string', format: 'uuid', example: '94312c93-5bb8-4144-8822-9a61ad1cd5a8' },
            __v: { type: 'number', example: 0 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 404,
    description: 'Collection not found',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Collection not found' },
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
  @Delete('/:id')
  async delete(@Res() response: FastifyReply, @Param('id') id) {
    if (!id) {
      throw new ValidationException('id is required.');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new ResourceNotFoundException('Collection not found for deletion.');
    }
    const deleted = await this.CollectionService.delete(id);
    if (!deleted) {
      throw new ResourceNotFoundException('Collection not found for deletion.');
    }
    return response.status(HttpStatus.OK).send({
      deleted,
    });
  }
}
