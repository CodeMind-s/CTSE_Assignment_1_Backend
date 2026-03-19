import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  PRIVATE = 'private',
  BROADCAST = 'broadcast',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: String, enum: NotificationType, default: NotificationType.PRIVATE })
  type: NotificationType;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  is_read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
