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
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { SvcKeyGuard } from '../../common/guards/svc-key.guard';
import {
  CreateListingDto,
  UpdateListingDto,
  ListingResponseDto,
  SearchResponseDto,
  AvailabilityResponseDto,
  RoomCountResponseDto,
  GenericResponseDto,
  HealthResponseDto,
} from '../../common/dto';

interface RoomsServiceGrpc {
  createListing(data: any): Observable<any>;
  getListing(data: any): Observable<any>;
  updateListing(data: any): Observable<any>;
  deleteListing(data: any): Observable<any>;
  searchListings(data: any): Observable<any>;
  checkAvailability(data: any): Observable<any>;
  getAvailability(data: any): Observable<any>;
  blockDates(data: any): Observable<any>;
  unblockDates(data: any): Observable<any>;
  getRoomCount(data: any): Observable<any>;
  healthCheck(data: any): Observable<any>;
}

@ApiTags('Listings')
@Controller('listings')
export class ListingsController implements OnModuleInit {
  private roomsService: RoomsServiceGrpc;

  constructor(
    @Inject('ROOMS_SERVICE') private readonly roomsClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.roomsService =
      this.roomsClient.getService<RoomsServiceGrpc>('RoomsService');
  }

  // ──────────────────────── Public ────────────────────────

  // GET /listings/count must be BEFORE /listings/:id to avoid route conflict
  @Get('count')
  @UseGuards(SvcKeyGuard)
  @ApiOperation({ summary: 'Get room count stats (svc-key auth)' })
  @ApiHeader({ name: 'x-svc-key', required: true, description: 'Service key for inter-service auth' })
  @ApiResponse({ status: 200, description: 'Room count stats', type: RoomCountResponseDto })
  async getRoomCount() {
    try {
      return await firstValueFrom(this.roomsService.getRoomCount({}));
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get room count',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Search listings by city, date, guests, and price' })
  @ApiQuery({ name: 'city', required: false, example: 'Colombo' })
  @ApiQuery({ name: 'checkIn', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'checkOut', required: false, example: '2026-04-05' })
  @ApiQuery({ name: 'guests', required: false, example: 2 })
  @ApiQuery({ name: 'minPrice', required: false, example: 50 })
  @ApiQuery({ name: 'maxPrice', required: false, example: 500 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'List of matching listings', type: SearchResponseDto })
  async search(
    @Query('city') city?: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
    @Query('guests') guests?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.roomsService.searchListings({
          city: city || '',
          checkIn: checkIn || '',
          checkOut: checkOut || '',
          guests: guests ? parseInt(guests) : 0,
          minPrice: minPrice ? parseFloat(minPrice) : 0,
          maxPrice: maxPrice ? parseFloat(maxPrice) : 0,
          page: page ? parseInt(page) : 1,
          limit: limit ? parseInt(limit) : 10,
        }),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get blocked dates for a listing (calendar view)' })
  @ApiResponse({ status: 200, description: 'Blocked dates array', type: AvailabilityResponseDto })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getAvailability(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.roomsService.getAvailability({ id }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Listing not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing details', type: ListingResponseDto })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getOne(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.roomsService.getListing({ id }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Listing not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ──────────────────────── JWT-protected ────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('host')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new listing (host only)' })
  @ApiBody({ type: CreateListingDto })
  @ApiResponse({ status: 201, description: 'Listing created', type: ListingResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — host role required' })
  async create(
    @Req() req: any,
    @Body() body: CreateListingDto,
  ) {
    try {
      return await firstValueFrom(
        this.roomsService.createListing({
          hostId: req.user.userId,
          title: body.title,
          city: body.city,
          description: body.description || '',
          price: body.price,
          maxGuests: body.maxGuests || 1,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create listing',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update a listing (ownership check: hostId === userId)' })
  @ApiBody({ type: UpdateListingDto })
  @ApiResponse({ status: 200, description: 'Listing updated', type: ListingResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateListingDto,
  ) {
    try {
      return await firstValueFrom(
        this.roomsService.updateListing({
          id,
          hostId: req.user.userId,
          ...body,
        }),
      );
    } catch (error) {
      const status = error.message?.includes('Forbidden')
        ? HttpStatus.FORBIDDEN
        : error.message?.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(error.message || 'Update failed', status);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete own listing (ownership check)' })
  @ApiResponse({ status: 200, description: 'Listing deleted', type: GenericResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async delete(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    try {
      return await firstValueFrom(
        this.roomsService.deleteListing({
          id,
          hostId: req.user.userId,
        }),
      );
    } catch (error) {
      const status = error.message?.includes('Forbidden')
        ? HttpStatus.FORBIDDEN
        : error.message?.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(error.message || 'Delete failed', status);
    }
  }

  // ──────────────────────── Service-key protected ────────────────────────

  @Patch(':id/block-dates')
  @UseGuards(SvcKeyGuard)
  @ApiOperation({ summary: 'Block date range (called by Reservation Service on booking)' })
  @ApiHeader({ name: 'x-svc-key', required: true, description: 'Service key for inter-service auth' })
  @ApiResponse({ status: 200, description: 'Dates blocked', type: GenericResponseDto })
  async blockDates(
    @Param('id') id: string,
    @Body() body: { start: string; end: string; reservationId: string },
  ) {
    try {
      return await firstValueFrom(
        this.roomsService.blockDates({
          listingId: id,
          start: body.start,
          end: body.end,
          reservationId: body.reservationId,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to block dates',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/unblock-dates')
  @UseGuards(SvcKeyGuard)
  @ApiOperation({ summary: 'Unblock dates (called on reservation cancellation)' })
  @ApiHeader({ name: 'x-svc-key', required: true, description: 'Service key for inter-service auth' })
  @ApiResponse({ status: 200, description: 'Dates unblocked', type: GenericResponseDto })
  async unblockDates(
    @Param('id') id: string,
    @Body() body: { start: string; end: string; reservationId: string },
  ) {
    try {
      return await firstValueFrom(
        this.roomsService.unblockDates({
          listingId: id,
          start: body.start,
          end: body.end,
          reservationId: body.reservationId,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to unblock dates',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
