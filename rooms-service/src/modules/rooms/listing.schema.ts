import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ListingDocument = Listing & Document;

@Schema()
export class BlockedDateRange {
  @Prop({ required: true })
  start: Date;

  @Prop({ required: true })
  end: Date;

  @Prop()
  reservationId: string;
}

export const BlockedDateRangeSchema =
  SchemaFactory.createForClass(BlockedDateRange);

@Schema({ timestamps: true })
export class Listing {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  hostId: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: [] })
  images: string[];

  @Prop({ default: 1 })
  maxGuests: number;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: [BlockedDateRangeSchema], default: [] })
  blockedDates: BlockedDateRange[];
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

// Text index for search
ListingSchema.index({ title: 'text', city: 'text', description: 'text' });
