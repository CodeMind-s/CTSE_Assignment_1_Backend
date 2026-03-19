import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ReviewService } from './review.service';

@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @GrpcMethod('ReviewService', 'AddReview')
  addReview(data: {
    userId: string;
    listingId: string;
    bookingId: string;
    rating: number;
    comment: string;
  }) {
    return this.reviewService.addReview(data);
  }

  @GrpcMethod('ReviewService', 'GetReviewsByListing')
  getReviewsByListing(data: { listingId: string; offset?: number; limit?: number }) {
    return this.reviewService.getReviewsByListing(data);
  }

  @GrpcMethod('ReviewService', 'GetMyReviews')
  getMyReviews(data: { userId: string; offset?: number; limit?: number }) {
    return this.reviewService.getMyReviews(data);
  }

  @GrpcMethod('ReviewService', 'UpdateReview')
  updateReview(data: {
    reviewId: string;
    userId: string;
    rating?: number;
    comment?: string;
  }) {
    return this.reviewService.updateReview(data);
  }

  @GrpcMethod('ReviewService', 'DeleteReview')
  deleteReview(data: { reviewId: string; userId: string }) {
    return this.reviewService.deleteReview(data);
  }
}
