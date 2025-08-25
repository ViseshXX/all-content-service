import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, now, Mixed } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

@Schema({ collection: 'content' })
export class content {
  @Prop({ default: uuidv4, index: true })
  contentId: string;

  @Prop({ type: String, required: false, index: true })
  @IsOptional()
  @IsString()
  collectionId: string;

  @Prop({ type: String, required: true })
  @IsOptional()
  @IsString()
  name: string;

  @Prop({ type: String, required: true, index: true })
  @IsString()
  contentType: string;

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  imagePath: string;

  @Prop({ required: true })
  contentSourceData: [Mixed];

  @Prop({ required: false, type: Array })
  @IsOptional()
  @IsArray()
  mechanics_data: [
    {
      mechanics_id: string;
      language: string;
      content_body?: string;
      jumbled_text?: string;
      text?: string;
      audio_url?: string;
      image_url?: string;
      options?: [
        {
          text: string;
          audio_url: string;
          image_url: string;
          isAns: boolean;
          side: string;
        },
      ];
      hints?: {
        text: string;
        audio_url: string;
        image_url: string;
      };
      time_limit?: number;
      correctness?: {
        '50%': [string];
      };
      syllable?: [
        {
          text: string,
          audio_url: string
        },
      ];
      words?: [string];
      imageAudioMap?: [{
        text: string,
        multilingual_id:string,
        audio_url: string,
        image_url: string,
      }];

    },
  ];
  @Prop({ type: Object, required: false })
  @IsOptional()
  @IsObject()
  multilingual?: {
    [langCode: string]: {
      text: string;
      audio_url: string;
    };
  };

  @Prop({ type: Object, required: false })
  @IsOptional()
  @IsObject()
  level_complexity: {
    level: string;
    level_competency: string;
    CEFR_level?: string;
  };

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  flaggedBy: string;

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  lastFlaggedOn: string;

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  flagReasons: string;

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  reviewer: string;

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  reviewStatus: string;

  @Prop({ type: String, required: true })
  @IsString()
  status: string;

  @Prop({ type: String, required: false })
  @IsOptional()
  @IsString()
  publisher: string;

  @Prop({ type: String, required: true, index: true })
  @IsString()
  language: string;

  @Prop({ type: Number, required: false })
  @IsOptional()
  @IsNumber()
  contentIndex: number;

  @Prop({ required: true })
  tags: [string];

  @Prop({ default: now(), index: true })
  createdAt: Date;

  @Prop({ default: now() })
  updatedAt: Date;
}

export type contentDocument = content & Document;

export const contentSchema = SchemaFactory.createForClass(content);

contentSchema.index({
  contentType: 1,
  'contentSourceData.language': 1,
});
