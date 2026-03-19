import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientGrpc, ClientKafka, RpcException } from '@nestjs/microservices';
import { Model } from 'mongoose';
import { firstValueFrom, Observable } from 'rxjs';
import { Review, ReviewDocument } from './review.schema';

interface BookingServiceGrpc {
  getBookingById(data: { bookingId: string }): Observable<any>;
}

interface UserServiceGrpc {
  getUserById(data: { id: string }): Observable<any>;
}

interface RoomsServiceGrpc {
  getListing(data: { id: string }): Observable<any>;
}

@Injectable()
export class ReviewService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewService.name);
  private bookingService: BookingServiceGrpc;
  private userService: UserServiceGrpc;
  private roomsService: RoomsServiceGrpc;

  constructor(
    @InjectModel(Review.name)
    private reviewModel: Model<ReviewDocument>,
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientGrpc,
    @Inject('USER_SERVICE') private readonly userClient: ClientGrpc,
    @Inject('ROOMS_SERVICE') private readonly roomsClient: ClientGrpc,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.bookingService =
      this.bookingClient.getService<BookingServiceGrpc>('BookingService');
    this.userService =
      this.userClient.getService<UserServiceGrpc>('UserService');
    this.roomsService =
      this.roomsClient.getService<RoomsServiceGrpc>('RoomsService');

    try {
      await this.kafkaClient.connect();
      this.logger.log('Kafka producer connected');
    } catch (err) {
      this.logger.error(`Kafka producer failed to connect on startup: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  // ---- Helpers ----

  private emitEvent(eventType: string, reviewData: Record<string, any>, hostId: string, guestId?: string) {
    const payload = { eventType, reviewData, hostId, guestId, timestamp: new Date().toISOString() };
    this.logger.log(`Publishing Kafka event: ${eventType} hostId=${hostId} guestId=${guestId}`);
    this.kafkaClient.emit('review-events', payload).subscribe({
      error: (err) => this.logger.error(`Kafka emit failed [${eventType}]: ${err.message}`),
    });
  }

  private async populateReview(review: ReviewDocument) {
    const [user, booking] = await Promise.all([
      firstValueFrom(this.userService.getUserById({ id: review.userId })).catch(() => null),
      firstValueFrom(this.bookingService.getBookingById({ bookingId: review.bookingId })).catch(() => null),
    ]);

    // Full room response — hostId needed for Kafka events
    let roomData: any = null;
    if (booking?.roomId) {
      roomData = await firstValueFrom(
        this.roomsService.getListing({ id: booking.roomId }),
      ).catch(() => null);
    }

    return {
      id: (review as any)._id.toString(),
      userId: review.userId,
      listingId: review.listingId,
      bookingId: review.bookingId,
      rating: review.rating,
      comment: review.comment,
      createdAt: (review as any).createdAt?.toISOString() || '',
      updatedAt: (review as any).updatedAt?.toISOString() || '',
      hostId: roomData?.hostId || '',
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      booking: booking
        ? {
            id: booking.id,
            guestId: booking.guestId,
            checkInTime: booking.checkInTime,
            checkOutTime: booking.checkOutTime,
            roomId: booking.roomId,
            reservationDate: booking.reservationDate,
          }
        : null,
      room: roomData
        ? { id: roomData.id, title: roomData.title, city: roomData.city, price: roomData.price }
        : null,
    };
  }

  private async getHostId(listingId: string): Promise<string> {
    try {
      const room = await firstValueFrom(this.roomsService.getListing({ id: listingId }));
      if (!room?.hostId) this.logger.warn(`No hostId for listing: ${listingId}`);
      return room?.hostId || '';
    } catch (error) {
      this.logger.error(`getHostId failed for listing ${listingId}: ${error.message}`);
      return '';
    }
  }

  // ---- gRPC handlers ----

  async addReview(data: {
    userId: string;
    listingId: string;
    bookingId: string;
    rating: number;
    comment: string;
  }) {
    let booking: any;
    try {
      booking = await firstValueFrom(
        this.bookingService.getBookingById({ bookingId: data.bookingId }),
      );
    } catch {
      throw new RpcException('No valid booking found for this listing');
    }

    if (!booking || !booking.id) {
      throw new RpcException('No valid booking found for this listing');
    }

    const existing = await this.reviewModel.findOne({
      userId: data.userId,
      listingId: data.listingId,
    });
    if (existing) throw new RpcException('Already reviewed this listing');

    if (data.rating < 1 || data.rating > 5) {
      throw new RpcException('Rating must be between 1 and 5');
    }

    const review = new this.reviewModel({
      userId: data.userId,
      listingId: data.listingId,
      bookingId: data.bookingId,
      rating: data.rating,
      comment: data.comment || '',
    });
    const saved = await review.save();
    const populated = await this.populateReview(saved);

    const guestId = populated.booking?.guestId || populated.userId;
    this.emitEvent('reviews.created', {
      reviewId: populated.id,
      userId: populated.userId,
      userName: populated.user?.name || '',
      listingId: populated.listingId,
      rating: populated.rating,
      comment: populated.comment,
      createdAt: populated.createdAt,
    }, populated.hostId, guestId);

    return populated;
  }

  async getReviewsByListing(data: { listingId: string; offset?: number; limit?: number }) {
    const offset = data.offset || 0;
    const limit = data.limit || 10;
    const [reviews, total] = await Promise.all([
      this.reviewModel.find({ listingId: data.listingId }).sort({ createdAt: -1 }).skip(offset).limit(limit).exec(),
      this.reviewModel.countDocuments({ listingId: data.listingId }),
    ]);
    const populated = await Promise.all(reviews.map((r) => this.populateReview(r)));
    return { reviews: populated, total, offset, limit };
  }

  async getMyReviews(data: { userId: string; offset?: number; limit?: number }) {
    const offset = data.offset || 0;
    const limit = data.limit || 10;
    const [reviews, total] = await Promise.all([
      this.reviewModel.find({ userId: data.userId }).sort({ createdAt: -1 }).skip(offset).limit(limit).exec(),
      this.reviewModel.countDocuments({ userId: data.userId }),
    ]);
    const populated = await Promise.all(reviews.map((r) => this.populateReview(r)));
    return { reviews: populated, total, offset, limit };
  }

  async updateReview(data: { reviewId: string; userId: string; rating?: number; comment?: string }) {
    const review = await this.reviewModel.findById(data.reviewId);
    if (!review) throw new RpcException('Review not found');
    if (review.userId !== data.userId) throw new RpcException('Unauthorized - only review owner can modify');

    if (data.rating !== undefined && data.rating !== 0) {
      if (data.rating < 1 || data.rating > 5) throw new RpcException('Rating must be between 1 and 5');
      review.rating = data.rating;
    }
    if (data.comment !== undefined && data.comment !== '') review.comment = data.comment;

    const updated = await review.save();
    const populated = await this.populateReview(updated);

    this.emitEvent('reviews.updated', {
      reviewId: populated.id,
      userId: populated.userId,
      userName: populated.user?.name || '',
      listingId: populated.listingId,
      rating: populated.rating,
      comment: populated.comment,
      updatedAt: populated.updatedAt,
    }, populated.hostId);

    return populated;
  }

  async deleteReview(data: { reviewId: string; userId: string }) {
    const review = await this.reviewModel.findById(data.reviewId);
    if (!review) return { ok: false, message: 'Review not found' };
    if (review.userId !== data.userId) return { ok: false, message: 'Unauthorized - only review owner can modify' };

    const { listingId, userId } = review;
    const reviewId = (review as any)._id.toString();
    await this.reviewModel.findByIdAndDelete(data.reviewId);

    // getHostId runs after delete — fire-and-forget
    this.getHostId(listingId).then((hostId) =>
      this.emitEvent('reviews.deleted', { reviewId, userId, listingId, deletedAt: new Date().toISOString() }, hostId),
    ).catch((err) => this.logger.error('Kafka emit failed (deleteReview)', err));

    return { ok: true, message: 'Review deleted successfully' };
  }
}
