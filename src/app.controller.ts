import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  @ApiExcludeEndpoint(true)
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Check if the Content Service application is running and healthy',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and running',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'boolean',
          example: true,
          description: 'Health status of the service',
        },
        message: {
          type: 'string',
          example: 'content ServiceApp is working',
          description: 'Health check message',
        },
      },
    },
  })
  @Get('/ping')
  checkHealth(): { status: boolean; message: string } {
    return {
      status: true,
      message: 'content ServiceApp is working',
    };
  }

  @ApiOperation({
    summary: 'Deep health check',
    description: 'Returns service health including dependency status',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status with dependency checks',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        services: {
          type: 'object',
          properties: { mongodb: { type: 'boolean' } },
        },
        uptime: { type: 'number' },
        timestamp: { type: 'string' },
      },
    },
  })
  @Get('/health')
  deepHealth() {
    const mongoOk = this.mongoConnection.readyState === 1;
    return {
      status: mongoOk ? 'ok' : 'degraded',
      services: { mongodb: mongoOk },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
