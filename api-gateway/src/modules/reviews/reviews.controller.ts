import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  OnModuleInit,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewsListResponseDto,
  ReviewResponseDto,
  GenericResponseDto,
} from '../../common/dto';

interface ReviewServiceGrpc {
  addReview(data: any): Observable<any>;
  getReviewsByListing(data: any): Observable<any>;
  getMyReviews(data: any): Observable<any>;
  updateReview(data: any): Observable<any>;
  deleteReview(data: any): Observable<any>;
}

@ApiTags('Reviews')
@Controller()
export class ReviewsController implements OnModuleInit {
  private reviewService: ReviewServiceGrpc;

  constructor(
    @Inject('REVIEW_SERVICE') private readonly reviewClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.reviewService =
      this.reviewClient.getService<ReviewServiceGrpc>('ReviewService');
  }

  // POST /reviews/listing/:listingId/booking/:bookingId — Guest
  @Post('reviews/listing/:listingId/booking/:bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('guest')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit a review for a listing (Guest)' })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({ status: 201, description: 'Review submitted', type: ReviewResponseDto })
  @ApiResponse({ status: 400, description: 'Already reviewed / invalid booking' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addReview(
    @Req() req: any,
    @Param('listingId') listingId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: CreateReviewDto,
  ) {
    try {
      const data = await firstValueFrom(
        this.reviewService.addReview({
          userId: req.user.userId,
          listingId,
          bookingId,
          rating: body.rating,
          comment: body.comment || '',
        }),
      );
      return { success: true, message: 'Review submitted successfully', data };
    } catch (error) {
      throw new HttpException(
        error.details || error.message || 'Failed to add review',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // GET /reviews/listing/:id — Public, with pagination
  @Get('reviews/listing/:id')
  @ApiOperation({ summary: 'Get all reviews for a listing (Public)' })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Reviews for listing', type: ReviewsListResponseDto })
  async getByListing(
    @Param('id') listingId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.reviewService.getReviewsByListing({
          listingId,
          offset: offset ? parseInt(offset) : 0,
          limit: limit ? parseInt(limit) : 10,
        }),
      );
      return {
        success: true,
        data: result.reviews,
        pagination: { total: result.total, offset: result.offset, limit: result.limit },
      };
    } catch (error) {
      throw new HttpException(
        error.details || error.message || 'Failed to fetch reviews',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /reviews/me — Guest, with pagination
  @Get('reviews/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "Get authenticated user's reviews (Guest)" })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: "User's reviews", type: ReviewsListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyReviews(
    @Req() req: any,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.reviewService.getMyReviews({
          userId: req.user.userId,
          offset: offset ? parseInt(offset) : 0,
          limit: limit ? parseInt(limit) : 10,
        }),
      );
      return {
        success: true,
        data: result.reviews,
        pagination: { total: result.total, offset: result.offset, limit: result.limit },
      };
    } catch (error) {
      throw new HttpException(
        error.details || error.message || 'Failed to fetch reviews',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH /reviews/:id — Review owner only
  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update a review (owner only, partial)' })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({ status: 200, description: 'Review updated', type: ReviewResponseDto })
  @ApiResponse({ status: 403, description: 'Unauthorized - only review owner can modify' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async updateReview(
    @Req() req: any,
    @Param('id') reviewId: string,
    @Body() body: UpdateReviewDto,
  ) {
    try {
      const data = await firstValueFrom(
        this.reviewService.updateReview({
          reviewId,
          userId: req.user.userId,
          rating: body.rating || 0,
          comment: body.comment || '',
        }),
      );
      return { success: true, message: 'Review updated successfully', data };
    } catch (error) {
      const msg = error.details || error.message || 'Update failed';
      const status = msg.includes('Unauthorized')
        ? HttpStatus.FORBIDDEN
        : msg.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(msg, status);
    }
  }

  // DELETE /reviews/:id — Review owner only
  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete a review (owner only)' })
  @ApiResponse({ status: 200, description: 'Review deleted', type: GenericResponseDto })
  @ApiResponse({ status: 403, description: 'Unauthorized - only review owner can modify' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async deleteReview(@Req() req: any, @Param('id') reviewId: string) {
    try {
      return await firstValueFrom(
        this.reviewService.deleteReview({
          reviewId,
          userId: req.user.userId,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.details || error.message || 'Delete failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
