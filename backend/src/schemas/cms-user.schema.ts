import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'cms_users', timestamps: true })
export class CmsUser {
  @Prop({ type: Number, required: true, unique: true, index: true })
  virtualId: number;

  @Prop({ type: String, required: true, unique: true, index: true })
  username: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, required: false })
  email: string;

  @Prop({ type: String, enum: ['admin', 'curator'], default: 'curator' })
  role: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type CmsUserDocument = CmsUser & Document;
export const CmsUserSchema = SchemaFactory.createForClass(CmsUser);
