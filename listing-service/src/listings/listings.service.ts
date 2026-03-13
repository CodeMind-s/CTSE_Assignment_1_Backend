import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Listing, ListingDocument } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingDto } from './dto/search-listing.dto';
import { BlockDatesDto } from './dto/block-dates.dto';

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
  ) {}

  async search(dto: SearchListingDto, isAdmin: boolean) {
    const query: any = {};

    if (!isAdmin) {
      query.active = true;
      query.suspended = false;
    }

    if (dto.city) {
      query.city = new RegExp(`^${dto.city}$`, 'i');
    }

    if (dto.search) {
      query.$text = { $search: dto.search };
    }

    if (dto.guests) {
      query.maxGuests = { $gte: dto.guests };
    }

    if (dto.minPrice || dto.maxPrice) {
      query.pricePerNight = {};
      if (dto.minPrice) query.pricePerNight.$gte = dto.minPrice;
      if (dto.maxPrice) query.pricePerNight.$lte = dto.maxPrice;
    }

    if (dto.checkIn && dto.checkOut) {
      const checkIn = new Date(dto.checkIn);
      const checkOut = new Date(dto.checkOut);
      query.blockedDates = {
        $not: {
          $elemMatch: {
            start: { $lt: checkOut },
            end: { $gt: checkIn },
          },
        },
      };
    }

    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 12, 50);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.listingModel.find(query).skip(skip).limit(limit).exec(),
      this.listingModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<ListingDocument> {
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async create(
    dto: CreateListingDto,
    hostId: string,
  ): Promise<ListingDocument> {
    const listing = new this.listingModel({ ...dto, hostId });
    return listing.save();
  }

  async update(
    id: string,
    dto: UpdateListingDto,
    userId: string,
  ): Promise<ListingDocument> {
    const listing = await this.findById(id);
    if (listing.hostId !== userId) {
      throw new ForbiddenException('You are not the owner of this listing');
    }
    Object.assign(listing, dto);
    return listing.save();
  }

  async remove(id: string, userId: string): Promise<void> {
    const listing = await this.findById(id);
    if (listing.hostId !== userId) {
      throw new ForbiddenException('You are not the owner of this listing');
    }
    await this.listingModel.findByIdAndDelete(id).exec();
  }

  async getAvailability(id: string, checkIn?: string, checkOut?: string) {
    const listing = await this.findById(id);
    const result: any = { blockedDates: listing.blockedDates };

    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const hasOverlap = listing.blockedDates.some(
        (blocked) =>
          new Date(blocked.start) < end && new Date(blocked.end) > start,
      );
      result.available = !hasOverlap;
    }

    return result;
  }

  async blockDates(id: string, dto: BlockDatesDto): Promise<ListingDocument> {
    const listing = await this.listingModel
      .findByIdAndUpdate(
        id,
        {
          $push: {
            blockedDates: {
              start: new Date(dto.start),
              end: new Date(dto.end),
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async unblockDates(
    id: string,
    dto: BlockDatesDto,
  ): Promise<ListingDocument> {
    const listing = await this.listingModel
      .findByIdAndUpdate(
        id,
        {
          $pull: {
            blockedDates: {
              start: new Date(dto.start),
              end: new Date(dto.end),
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async getCount() {
    const [total, byCity] = await Promise.all([
      this.listingModel.countDocuments().exec(),
      this.listingModel.aggregate([
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $project: { city: '$_id', count: 1, _id: 0 } },
      ]),
    ]);
    return { total, byCity };
  }

  async findByHost(hostId: string): Promise<ListingDocument[]> {
    return this.listingModel.find({ hostId }).exec();
  }

  async suspendListing(id: string): Promise<ListingDocument> {
    const listing = await this.findById(id);
    listing.suspended = !listing.suspended;
    return listing.save();
  }

  async forceDelete(id: string): Promise<void> {
    const listing = await this.listingModel.findByIdAndDelete(id).exec();
    if (!listing) throw new NotFoundException('Listing not found');
  }
}
