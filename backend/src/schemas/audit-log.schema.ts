import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'audit_logs', timestamps: false })
export class AuditLog {
  @Prop({ type: String, default: uuidv4, unique: true, index: true })
  auditId: string;

  @Prop({
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'BULK_UPLOAD', 'LOGIN', 'LOGOUT'],
    index: true,
  })
  action: string;

  @Prop({
    type: String,
    required: true,
    enum: ['content', 'collection', 'multilingual', 'bulk_upload', 'user', 'auth'],
    index: true,
  })
  resource: string;

  @Prop({ type: String, required: false })
  resourceId: string;

  @Prop({ type: String, required: false })
  resourceName: string;

  @Prop({
    type: Object,
    required: true,
  })
  actor: {
    virtualId: number;
    username: string;
    role: string;
  };

  @Prop({ type: Object, required: false })
  changes: Record<string, { from: any; to: any }>;

  @Prop({ type: String, required: false })
  summary: string;

  @Prop({ type: String, required: false })
  ipAddress: string;

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;
}

export type AuditLogDocument = AuditLog & Document;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
