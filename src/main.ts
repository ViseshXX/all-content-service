import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppClusterService } from './app-cluster.service';
import * as cors from 'cors';
import { ValidationException } from './common/exceptions/api.exceptions';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';


async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const errorItems = errors.flatMap((e) => {
          const constraints = e.constraints || {};
          return Object.entries(constraints).map(([constraintCode, constraintMessage]) => ({
            field: e.property,
            message: String(constraintMessage),
            code: constraintCode,
          }));
        });
        const message =
          errorItems[0]?.message ||
          errors
            .map((e) => Object.values(e.constraints || {}).join(', '))
            .filter(Boolean)
            .join(', ') ||
          'Validation failed.';
        return new ValidationException(message, errorItems);
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('v1');
  
  const config = new DocumentBuilder()
    .setTitle('ALL Content Service API')
    .setDescription(
      `## Overview
The ALL (Adaptive Learning & Literacy) Content Service provides APIs for managing educational content including words, sentences, paragraphs, and characters in multiple Indian languages.

## Features
- **Content Management**: Create, read, update, and delete content items with automatic phoneme and complexity analysis
- **Collection Management**: Organize content into collections by language, category, and tags
- **Multilingual Support**: Support for English (en), Hindi (hi), Tamil (ta), Kannada (kn), Telugu (te), and Gujarati (gu)
- **Assessment Support**: Retrieve assessment collections (ASER, NAS) with set-based filtering
- **Complexity Analysis**: Automatic syllable counting, word frequency, and reading complexity calculation

## Authentication
All API endpoints (except health check) require JWT Bearer token authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Content Types
- **Word**: Individual words with phoneme breakdown
- **Sentence**: Complete sentences with word analysis
- **Paragraph**: Multi-sentence content for reading practice
- **Char**: Individual characters for alphabet learning`,
    )
    .setVersion('1.0.0')
    .addServer(process.env.SERVER_URL || 'http://localhost:3008', 'ALL Content Service Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('health', 'Health check and monitoring endpoints')
    .addTag('content', 'Content management endpoints for words, sentences, paragraphs, and characters')
    .addTag('collection', 'Collection management endpoints for organizing content')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'ALL Content Service - API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
  });

  // Cors aalowd for the specific url
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });


  // content-security-policys added
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (_request, reply, payload) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Content-Security-Policy', "default-src 'self'");
      reply.header('X-XSS-Protection', '1; mode=block');
      return payload;
    });

  await app.listen(3008, '0.0.0.0');
}
AppClusterService.clusterize(bootstrap);
