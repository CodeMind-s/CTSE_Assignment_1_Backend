import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ListingDocument = HydratedDocument<Listing>;

@Schema({ timestamps: true })
export class Listing {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, index: true })
  city: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  pricePerNight: number;

  @Prop({ required: true })
  maxGuests: number;

  @Prop()
  bedrooms: number;

  @Prop()
  bathrooms: number;

  @Prop([String])
  amenities: string[];

  @Prop([String])
  images: string[];

  @Prop({ required: true, index: true })
  hostId: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: false })
  suspended: boolean;

  @Prop([{ start: Date, end: Date }])
  blockedDates: { start: Date; end: Date }[];
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

ListingSchema.index({ title: 'text', city: 'text', description: 'text' });
