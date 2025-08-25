import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, now } from 'mongoose';
import {
  IsString,
  IsObject,
} from 'class-validator';

@Schema({ collection: 'multilingual' })
export class multilingual {
  @Prop({ type: String, required: true, index: true })
  @IsString()
  multilingual_id: string;

  @Prop({ type: Object, required: true })
  @IsObject()
  multilingual: {
    [langCode: string]: {
      text: string;
      audio_url: string;
    };
  };

  @Prop({ default: now(), index: true })
  createdAt: Date;

  @Prop({ default: now() })
  updatedAt: Date;
}

export type multilingualDocument = multilingual & Document;
export const multilingualSchema = SchemaFactory.createForClass(multilingual); 