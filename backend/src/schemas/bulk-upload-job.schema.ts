import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'bulk_upload_jobs', timestamps: true })
export class BulkUploadJob {
  @Prop({ type: String, default: uuidv4, index: true, unique: true })
  jobId: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true,
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  totalRows: number;

  @Prop({ type: Number, default: 0 })
  processedRows: number;

  @Prop({ type: Number, default: 0 })
  failedRows: number;

  @Prop({ type: Number, default: 0 })
  resumeCount: number;

  @Prop({ type: String, required: false })
  errorMessage: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  wizardConfig: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  generatedCollections: Record<string, string>;

  @Prop({ type: String, required: true })
  zipFilename: string;

  @Prop({ type: String, required: false })
  authToken: string;

  @Prop({ type: Object, required: false })
  submittedBy: { virtualId: number; username: string; role: string };

  @Prop({ type: String, required: false })
  resultCollectionId?: string;

  @Prop({ type: String, required: false })
  resultCollectionName?: string;

  @Prop({
    type: [
      {
        _id: false,
        rowIndex: { type: Number },
        sheetName: { type: String },
        error: { type: String },
      },
    ],
    default: [],
  })
  failedRowDetails: { rowIndex: number; sheetName: string; error: string }[];
}

export type BulkUploadJobDocument = BulkUploadJob & Document;
export const BulkUploadJobSchema = SchemaFactory.createForClass(BulkUploadJob);
