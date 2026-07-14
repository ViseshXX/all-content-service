import * as path from 'path';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { content, contentSchema } from 'src/schemas/content.schema';
import { collection, collectionDbSchema } from './schemas/collection.schema';
import { multilingual, multilingualSchema } from './schemas/multilingual.schema';
import { contentService } from 'src/services/content.service';
import { contentController } from 'src/controllers/content.controller';
import { ConfigModule } from '@nestjs/config';
import { CollectionController } from './controllers/collection.controller';
import { CollectionService } from './services/collection.service';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth/auth.module';
import { BulkUploadController } from './controllers/bulk-upload.controller';
import { BulkIngestService } from './services/bulk-ingest.service';
import { BulkProcessorService } from './services/bulk-processor.service';
import { BulkUploadJob, BulkUploadJobSchema } from './schemas/bulk-upload-job.schema';
import { CmsUser, CmsUserSchema } from './schemas/cms-user.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { CmsUserService } from './services/cms-user.service';
import { AuditLogService } from './services/audit-log.service';
import { AssetPipelineService } from './services/asset-pipeline.service';
import { SingleContentAssetService } from './services/single-content-asset.service';
import { AuthController } from './controllers/auth.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { AuditLogController } from './controllers/audit-log.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '..', '..', '.env'),
    }),

    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URL,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        connectionFactory: (connection) => {
          connection.set('poolSize', process.env.POOL_SIZE);
          return connection;
        },
      }),
    }),

    MongooseModule.forFeature([
      { name: content.name, schema: contentSchema },
      { name: collection.name, schema: collectionDbSchema },
      { name: multilingual.name, schema: multilingualSchema },
      { name: BulkUploadJob.name, schema: BulkUploadJobSchema },
      { name: CmsUser.name, schema: CmsUserSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    AuthModule
  ],
  controllers: [AppController, contentController, CollectionController, BulkUploadController, AuthController, UserManagementController, AuditLogController],
  providers: [AppService, contentService, CollectionService, BulkIngestService, BulkProcessorService, CmsUserService, AuditLogService, AssetPipelineService, SingleContentAssetService],
})
export class AppModule {}
