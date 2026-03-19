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
  CreateBookingDto,
  UpdateBookingDto,
  BookingResponseDto,
  BookingsListResponseDto,
  GenericResponseDto,
} from '../../common/dto';

interface BookingServiceGrpc {
  createBooking(data: any): Observable<any>;
  getMyBookings(data: any): Observable<any>;
  getBookingById(data: any): Observable<any>;
  updateBooking(data: any): Observable<any>;
  deleteBooking(data: any): Observable<any>;
  getAllBookings(data: any): Observable<any>;
}

@ApiTags('Bookings')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class BookingsController implements OnModuleInit {
  private bookingService: BookingServiceGrpc;

  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.bookingService =
      this.bookingClient.getService<BookingServiceGrpc>('BookingService');
  }

  // POST /bookings/room/:id — Guest: create booking for a room
  @Post('bookings/room/:id')
  @Roles('guest')
  @ApiOperation({ summary: 'Create a booking for a room (Guest)' })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({ status: 201, description: 'Booking created', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBooking(
    @Req() req: any,
    @Param('id') roomId: string,
    @Body() body: CreateBookingDto,
  ) {
    try {
      const data = await firstValueFrom(
        this.bookingService.createBooking({
          guestId: req.user.userId,
          roomId,
          reservationDate: body.reservationDate,
          checkInTime: body.checkInTime,
          checkOutTime: body.checkOutTime,
          memberCount: body.memberCount,
          board: body.board,
        }),
      );
      return { success: true, message: 'Booking created successfully', data };
    } catch (error) {
      throw new HttpException(
        error.message || 'Booking failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // GET /bookings/me — Guest: get own bookings with optional filters + pagination
  @Get('bookings/me')
  @Roles('guest')
  @ApiOperation({ summary: "Get authenticated guest's bookings (Guest)" })
  @ApiQuery({ name: 'board', required: false, enum: ['full', 'half'] })
  @ApiQuery({ name: 'reservationDate', required: false, example: '2026-04-15' })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'List of bookings', type: BookingsListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyBookings(
    @Req() req: any,
    @Query('board') board?: string,
    @Query('reservationDate') reservationDate?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.bookingService.getMyBookings({
          guestId: req.user.userId,
          board: board || '',
          reservationDate: reservationDate || '',
          offset: offset ? parseInt(offset) : 0,
          limit: limit ? parseInt(limit) : 10,
        }),
      );
      return {
        success: true,
        data: result.bookings,
        pagination: {
          total: result.total,
          offset: result.offset,
          limit: result.limit,
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /booking/:id — Guest: get single booking by ID
  @Get('booking/:id')
  @Roles('guest')
  @ApiOperation({ summary: 'Get a booking by ID (Guest)' })
  @ApiResponse({ status: 200, description: 'Booking details', type: BookingResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBookingById(@Param('id') id: string) {
    try {
      const data = await firstValueFrom(
        this.bookingService.getBookingById({ bookingId: id }),
      );
      return { success: true, message: 'Booking retrieved', data };
    } catch (error) {
      throw new HttpException(
        error.message || 'Booking not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // PATCH /booking/:id — Guest: partial update
  @Patch('booking/:id')
  @Roles('guest')
  @ApiOperation({ summary: 'Update a booking (Guest, partial update)' })
  @ApiBody({ type: UpdateBookingDto })
  @ApiResponse({ status: 200, description: 'Booking updated', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateBooking(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateBookingDto,
  ) {
    try {
      const data = await firstValueFrom(
        this.bookingService.updateBooking({
          bookingId: id,
          guestId: req.user.userId,
          ...body,
        }),
      );
      return { success: true, message: 'Booking updated successfully', data };
    } catch (error) {
      throw new HttpException(
        error.message || 'Update failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // DELETE /booking/:id — Guest (owner) or Admin
  @Delete('booking/:id')
  @ApiOperation({ summary: 'Delete a booking (Guest owner or Admin)' })
  @ApiResponse({ status: 200, description: 'Booking deleted', type: GenericResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteBooking(@Req() req: any, @Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.bookingService.deleteBooking({
          bookingId: id,
          requesterId: req.user.userId,
          requesterRole: req.user.role,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Delete failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // GET /bookings/all — Admin: all bookings with filters + pagination
  @Get('bookings/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all bookings in the system (Admin)' })
  @ApiQuery({ name: 'board', required: false, enum: ['full', 'half'] })
  @ApiQuery({ name: 'reservationDate', required: false, example: '2026-04-15' })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'All bookings', type: BookingsListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllBookings(
    @Query('board') board?: string,
    @Query('reservationDate') reservationDate?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await firstValueFrom(
        this.bookingService.getAllBookings({
          board: board || '',
          reservationDate: reservationDate || '',
          offset: offset ? parseInt(offset) : 0,
          limit: limit ? parseInt(limit) : 10,
        }),
      );
      return {
        success: true,
        data: result.bookings,
        pagination: {
          total: result.total,
          offset: result.offset,
          limit: result.limit,
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
