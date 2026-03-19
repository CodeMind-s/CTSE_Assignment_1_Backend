import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BookingService } from './booking.service';

@Controller()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @GrpcMethod('BookingService', 'CreateBooking')
  createBooking(data: {
    guestId: string;
    roomId: string;
    reservationDate: string;
    checkInTime: string;
    checkOutTime: string;
    memberCount: number;
    board: string;
  }) {
    return this.bookingService.createBooking(data);
  }

  @GrpcMethod('BookingService', 'GetMyBookings')
  getMyBookings(data: {
    guestId: string;
    board?: string;
    reservationDate?: string;
    offset?: number;
    limit?: number;
  }) {
    return this.bookingService.getMyBookings(data);
  }

  @GrpcMethod('BookingService', 'GetBookingById')
  getBookingById(data: { bookingId: string }) {
    return this.bookingService.getBookingById(data);
  }

  @GrpcMethod('BookingService', 'UpdateBooking')
  updateBooking(data: {
    bookingId: string;
    guestId: string;
    reservationDate?: string;
    checkInTime?: string;
    checkOutTime?: string;
    memberCount?: number;
    board?: string;
  }) {
    return this.bookingService.updateBooking(data);
  }

  @GrpcMethod('BookingService', 'DeleteBooking')
  deleteBooking(data: {
    bookingId: string;
    requesterId: string;
    requesterRole: string;
  }) {
    return this.bookingService.deleteBooking(data);
  }

  @GrpcMethod('BookingService', 'GetAllBookings')
  getAllBookings(data: {
    board?: string;
    reservationDate?: string;
    offset?: number;
    limit?: number;
  }) {
    return this.bookingService.getAllBookings(data);
  }

  @GrpcMethod('BookingService', 'ValidateBooking')
  validateBooking(data: { bookingId: string }) {
    return this.bookingService.validateBooking(data);
  }

  // ---- Admin gRPC handlers ----

  @GrpcMethod('BookingService', 'GetBookingsByRoom')
  getBookingsByRoom(data: { roomId: string }) {
    return this.bookingService.getBookingsByRoom(data);
  }

  @GrpcMethod('BookingService', 'ForceCancelBooking')
  forceCancelBooking(data: { bookingId: string }) {
    return this.bookingService.forceCancelBooking(data);
  }

  @GrpcMethod('BookingService', 'GetBookingStats')
  getBookingStats() {
    return this.bookingService.getBookingStats();
  }
}
