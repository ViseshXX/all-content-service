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


async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('v1');
  
  const config = new DocumentBuilder()
    .setTitle('ALL Content Service')
    .setDescription(
      'All content service includes Storys , word, sentences texts to practice',
    )
    .setVersion('v1')
    .addServer(process.env.SERVER_URL, 'ALL Content Service Server APIs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

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
    .addHook('onSend', async (request, reply, payload) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Content-Security-Policy', "default-src 'self'");
      reply.header('X-XSS-Protection', '1; mode=block');
      return payload;
    });

  await app.listen(3008, '0.0.0.0');
}
AppClusterService.clusterize(bootstrap);
