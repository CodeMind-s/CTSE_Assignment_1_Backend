import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Listing, ListingDocument } from './listing.schema';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
  ) {}

  async createListing(data: {
    hostId: string;
    title: string;
    city: string;
    description: string;
    price: number;
    maxGuests?: number;
  }) {
    const listing = new this.listingModel({
      ...data,
      maxGuests: data.maxGuests || 1,
    });
    const saved = await listing.save();
    return this.toListingResp(saved);
  }

  async getListing(id: string) {
    const listing = await this.listingModel.findById(id);
    if (!listing) {
      throw new Error('Listing not found');
    }
    return this.toListingResp(listing);
  }

  async updateListing(data: {
    id: string;
    hostId: string;
    title?: string;
    city?: string;
    description?: string;
    price?: number;
    maxGuests?: number;
  }) {
    const listing = await this.listingModel.findById(data.id);
    if (!listing) {
      throw new Error('Listing not found');
    }
    if (listing.hostId !== data.hostId) {
      throw new Error('Forbidden: you do not own this listing');
    }

    const updateFields: any = {};
    if (data.title) updateFields.title = data.title;
    if (data.city) updateFields.city = data.city;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.price) updateFields.price = data.price;
    if (data.maxGuests) updateFields.maxGuests = data.maxGuests;

    const updated = await this.listingModel.findByIdAndUpdate(
      data.id,
      { $set: updateFields },
      { new: true },
    );
    return this.toListingResp(updated);
  }

  async deleteListing(data: { id: string; hostId: string }) {
    const listing = await this.listingModel.findById(data.id);
    if (!listing) {
      throw new Error('Listing not found');
    }
    if (listing.hostId !== data.hostId) {
      throw new Error('Forbidden: you do not own this listing');
    }

    await this.listingModel.findByIdAndDelete(data.id);
    return { ok: true, message: 'Listing deleted successfully' };
  }

  async searchListings(data: {
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const { city, checkIn, checkOut, guests, page = 1, limit = 10, minPrice, maxPrice } = data;

    const filter: any = { active: true };
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // Price range filtering
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = minPrice;
      if (maxPrice) filter.price.$lte = maxPrice;
    }

    // Guest capacity filtering
    if (guests && guests > 0) {
      filter.maxGuests = { $gte: guests };
    }

    // If date range provided, exclude listings with overlapping blocked dates
    if (checkIn && checkOut) {
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);
      filter.blockedDates = {
        $not: {
          $elemMatch: {
            start: { $lt: endDate },
            end: { $gt: startDate },
          },
        },
      };
    }

    const skip = (page - 1) * limit;
    const [listings, total] = await Promise.all([
      this.listingModel.find(filter).skip(skip).limit(limit).exec(),
      this.listingModel.countDocuments(filter),
    ]);

    return {
      listings: listings.map((l) => this.toListingResp(l)),
      total,
    };
  }

  async checkAvailability(data: {
    listingId: string;
    start: string;
    end: string;
  }) {
    const listing = await this.listingModel.findById(data.listingId);
    if (!listing) {
      return { available: false };
    }

    const startDate = new Date(data.start);
    const endDate = new Date(data.end);

    const hasConflict = listing.blockedDates.some((blocked) => {
      const bStart = new Date(blocked.start);
      const bEnd = new Date(blocked.end);
      return bStart < endDate && bEnd > startDate;
    });

    return { available: !hasConflict };
  }

  async getAvailability(id: string) {
    const listing = await this.listingModel.findById(id);
    if (!listing) {
      throw new Error('Listing not found');
    }

    const blockedDates = listing.blockedDates.map((bd) => ({
      start: new Date(bd.start).toISOString(),
      end: new Date(bd.end).toISOString(),
      reservationId: bd.reservationId || '',
    }));

    return { blockedDates };
  }

  async blockDates(data: {
    listingId: string;
    start: string;
    end: string;
    reservationId: string;
  }) {
    const result = await this.listingModel.findByIdAndUpdate(
      data.listingId,
      {
        $push: {
          blockedDates: {
            start: new Date(data.start),
            end: new Date(data.end),
            reservationId: data.reservationId,
          },
        },
      },
      { new: true },
    );

    if (!result) {
      return { ok: false, message: 'Listing not found' };
    }
    return { ok: true, message: 'Dates blocked successfully' };
  }

  async unblockDates(data: {
    listingId: string;
    start: string;
    end: string;
    reservationId: string;
  }) {
    const result = await this.listingModel.findByIdAndUpdate(
      data.listingId,
      {
        $pull: {
          blockedDates: { reservationId: data.reservationId },
        },
      },
      { new: true },
    );

    if (!result) {
      return { ok: false, message: 'Listing not found' };
    }
    return { ok: true, message: 'Dates unblocked successfully' };
  }

  async getRoomCount() {
    const [total, byCity] = await Promise.all([
      this.listingModel.countDocuments({ active: true }),
      this.listingModel.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $project: { city: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return { total, byCity };
  }

  async healthCheck() {
    return {
      status: 'ok',
      service: 'rooms-service',
      timestamp: new Date().toISOString(),
    };
  }

  // ---- Admin methods ----

  async suspendListing(id: string) {
    const listing = await this.listingModel.findById(id);
    if (!listing) {
      throw new Error('Listing not found');
    }
    listing.active = !listing.active;
    const saved = await listing.save();
    return this.toListingResp(saved);
  }

  async adminDeleteListing(id: string) {
    const listing = await this.listingModel.findById(id);
    if (!listing) {
      return { ok: false, message: 'Listing not found' };
    }
    await this.listingModel.findByIdAndDelete(id);
    return { ok: true, message: 'Listing deleted by admin' };
  }

  async adminSearchListings(data: {
    page?: number;
    limit?: number;
    city?: string;
    status?: string;
    host?: string;
  }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (data.city) {
      filter.city = { $regex: data.city, $options: 'i' };
    }
    if (data.status === 'active') {
      filter.active = true;
    } else if (data.status === 'suspended') {
      filter.active = false;
    }
    if (data.host) {
      filter.hostId = data.host;
    }

    const [listings, total] = await Promise.all([
      this.listingModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.listingModel.countDocuments(filter),
    ]);

    return {
      listings: listings.map((l) => this.toListingResp(l)),
      total,
    };
  }

  async getListingsByHost(hostId: string) {
    const listings = await this.listingModel.find({ hostId }).exec();
    return {
      listings: listings.map((l) => this.toListingResp(l)),
      total: listings.length,
    };
  }

  private toListingResp(listing: ListingDocument) {
    return {
      id: listing._id.toString(),
      hostId: listing.hostId,
      title: listing.title,
      city: listing.city,
      description: listing.description || '',
      price: listing.price,
      maxGuests: listing.maxGuests || 1,
      images: listing.images || [],
      active: listing.active,
    };
  }
}
