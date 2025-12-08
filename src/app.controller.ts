import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
