import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { Booking, BoardType } from './booking.entity';
import { KafkaProducerService } from './kafka-producer.service';

interface UserServiceGrpc {
  getUserById(data: { id: string }): Observable<any>;
}

interface RoomsServiceGrpc {
  getListing(data: { id: string }): Observable<any>;
}

@Injectable()
export class BookingService implements OnModuleInit {
  private userService: UserServiceGrpc;
  private roomsService: RoomsServiceGrpc;

  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @Inject('USER_SERVICE') private readonly userClient: ClientGrpc,
    @Inject('ROOMS_SERVICE') private readonly roomsClient: ClientGrpc,
    private readonly kafka: KafkaProducerService,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserServiceGrpc>('UserService');
    this.roomsService = this.roomsClient.getService<RoomsServiceGrpc>('RoomsService');
  }

  // ---- Populate helpers ----

  private async getUser(id: string) {
    try {
      return await firstValueFrom(this.userService.getUserById({ id }));
    } catch {
      return null;
    }
  }

  private async getRoom(id: string) {
    try {
      return await firstValueFrom(this.roomsService.getListing({ id }));
    } catch {
      return null;
    }
  }

  private async populateBooking(booking: Booking) {
    const [guest, room, host] = await Promise.all([
      this.getUser(booking.guestId),
      this.getRoom(booking.roomId),
      booking.hostId ? this.getUser(booking.hostId) : Promise.resolve(null),
    ]);

    return {
      id: booking.id,
      guestId: booking.guestId,
      roomId: booking.roomId,
      hostId: booking.hostId,
      reservationDate: booking.reservationDate,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      memberCount: booking.memberCount,
      board: booking.board,
      createdAt: booking.createdAt?.toISOString() || '',
      updatedAt: booking.updatedAt?.toISOString() || '',
      guest: guest
        ? { id: guest.id, name: guest.name, email: guest.email, role: guest.role }
        : null,
      room: room
        ? { id: room.id, title: room.title, city: room.city, description: room.description, price: room.price }
        : null,
      host: host
        ? { id: host.id, name: host.name, email: host.email, role: host.role }
        : null,
    };
  }

  // ---- gRPC handlers ----

  async createBooking(data: {
    guestId: string;
    roomId: string;
    reservationDate: string;
    checkInTime: string;
    checkOutTime: string;
    memberCount: number;
    board: string;
  }) {
    // Fetch room to get hostId
    let room: any;
    try {
      room = await firstValueFrom(this.roomsService.getListing({ id: data.roomId }));
    } catch {
      throw new Error('Room not found');
    }

    const booking = this.bookingRepo.create({
      guestId: data.guestId,
      roomId: data.roomId,
      hostId: room.hostId || '',
      reservationDate: data.reservationDate,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      memberCount: data.memberCount || 1,
      board: (data.board as BoardType) || BoardType.FULL,
    });

    const saved = await this.bookingRepo.save(booking);

    // Publish Kafka event
    this.kafka
      .publishBookingEvent({
        type: 'BOOKING_CREATED',
        bookingId: saved.id,
        guestId: saved.guestId,
        roomTitle: room.title || saved.roomId,
        reservationDate: saved.reservationDate,
      })
      .catch(() => {});

    return this.populateBooking(saved);
  }

  async getMyBookings(data: {
    guestId: string;
    board?: string;
    reservationDate?: string;
    offset?: number;
    limit?: number;
  }) {
    const offset = data.offset || 0;
    const limit = data.limit || 10;

    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.guestId = :guestId', { guestId: data.guestId });

    if (data.board) {
      qb.andWhere('booking.board = :board', { board: data.board });
    }
    if (data.reservationDate) {
      qb.andWhere('booking.reservationDate = :date', { date: data.reservationDate });
    }

    const [rows, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const bookings = await Promise.all(rows.map((b) => this.populateBooking(b)));
    return { bookings, total, offset, limit };
  }

  async getBookingById(data: { bookingId: string }) {
    const booking = await this.bookingRepo.findOne({ where: { id: data.bookingId } });
    if (!booking) throw new Error('Booking not found');
    return this.populateBooking(booking);
  }

  async updateBooking(data: {
    bookingId: string;
    guestId: string;
    reservationDate?: string;
    checkInTime?: string;
    checkOutTime?: string;
    memberCount?: number;
    board?: string;
  }) {
    const booking = await this.bookingRepo.findOne({ where: { id: data.bookingId } });
    if (!booking) throw new Error('Booking not found');
    if (booking.guestId !== data.guestId) throw new Error('Unauthorized');

    if (data.reservationDate !== undefined) booking.reservationDate = data.reservationDate;
    if (data.checkInTime !== undefined) booking.checkInTime = data.checkInTime;
    if (data.checkOutTime !== undefined) booking.checkOutTime = data.checkOutTime;
    if (data.memberCount !== undefined) booking.memberCount = data.memberCount;
    if (data.board !== undefined) booking.board = data.board as BoardType;

    const updated = await this.bookingRepo.save(booking);

    let roomTitle = updated.roomId;
    try {
      const room = await firstValueFrom(this.roomsService.getListing({ id: updated.roomId }));
      roomTitle = room.title || updated.roomId;
    } catch {}

    this.kafka
      .publishBookingEvent({
        type: 'BOOKING_UPDATED',
        bookingId: updated.id,
        guestId: updated.guestId,
        roomTitle,
        reservationDate: updated.reservationDate,
      })
      .catch(() => {});

    return this.populateBooking(updated);
  }

  async deleteBooking(data: {
    bookingId: string;
    requesterId: string;
    requesterRole: string;
  }) {
    const booking = await this.bookingRepo.findOne({ where: { id: data.bookingId } });
    if (!booking) return { ok: false, message: 'Booking not found' };

    const isOwner = booking.guestId === data.requesterId;
    const isAdmin = data.requesterRole === 'admin';
    if (!isOwner && !isAdmin) return { ok: false, message: 'Unauthorized' };

    let roomTitle = booking.roomId;
    try {
      const room = await firstValueFrom(this.roomsService.getListing({ id: booking.roomId }));
      roomTitle = room.title || booking.roomId;
    } catch {}

    await this.bookingRepo.remove(booking);

    this.kafka
      .publishBookingEvent({
        type: 'BOOKING_DELETED',
        bookingId: data.bookingId,
        guestId: booking.guestId,
        roomTitle,
        reservationDate: booking.reservationDate,
      })
      .catch(() => {});

    return { ok: true, message: 'Booking deleted successfully' };
  }

  async getAllBookings(data: {
    board?: string;
    reservationDate?: string;
    offset?: number;
    limit?: number;
  }) {
    const offset = data.offset || 0;
    const limit = data.limit || 10;

    const qb = this.bookingRepo.createQueryBuilder('booking');

    if (data.board) {
      qb.andWhere('booking.board = :board', { board: data.board });
    }
    if (data.reservationDate) {
      qb.andWhere('booking.reservationDate = :date', { date: data.reservationDate });
    }

    const [rows, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const bookings = await Promise.all(rows.map((b) => this.populateBooking(b)));
    return { bookings, total, offset, limit };
  }

  // Kept for review-service backward compatibility
  async validateBooking(data: { bookingId: string }) {
    const booking = await this.bookingRepo.findOne({ where: { id: data.bookingId } });
    if (!booking) return { ok: false, message: 'Booking not found' };
    return { ok: true, message: 'Booking is valid' };
  }

  // ---- Admin methods ----

  async getBookingsByRoom(data: { roomId: string }) {
    const [rows, total] = await this.bookingRepo.findAndCount({
      where: { roomId: data.roomId },
      order: { createdAt: 'DESC' },
    });

    const bookings = await Promise.all(rows.map((b) => this.populateBooking(b)));
    return { bookings, total, offset: 0, limit: total };
  }

  async forceCancelBooking(data: { bookingId: string }) {
    const booking = await this.bookingRepo.findOne({ where: { id: data.bookingId } });
    if (!booking) return { ok: false, message: 'Booking not found' };

    let roomTitle = booking.roomId;
    try {
      const room = await firstValueFrom(this.roomsService.getListing({ id: booking.roomId }));
      roomTitle = room.title || booking.roomId;
    } catch {}

    await this.bookingRepo.remove(booking);

    this.kafka
      .publishBookingEvent({
        type: 'BOOKING_DELETED',
        bookingId: data.bookingId,
        guestId: booking.guestId,
        roomTitle,
        reservationDate: booking.reservationDate,
      })
      .catch(() => {});

    return { ok: true, message: 'Booking force-cancelled by admin' };
  }

  async getBookingStats() {
    const totalBookings = await this.bookingRepo.count();

    // Monthly reservation counts with revenue from room prices
    const rawMonthly = await this.bookingRepo
      .createQueryBuilder('booking')
      .select("TO_CHAR(booking.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(booking.createdAt, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    // Calculate revenue per booking by looking up room prices
    const allBookings = await this.bookingRepo.find();
    let totalRevenue = 0;

    for (const booking of allBookings) {
      try {
        const room = await firstValueFrom(this.roomsService.getListing({ id: booking.roomId }));
        totalRevenue += room.price || 0;
      } catch {
        // Room might be deleted
      }
    }

    const monthlyReservations = rawMonthly.map((row) => ({
      month: row.month,
      count: parseInt(row.count),
      revenue: 0, // per-month revenue would need more complex aggregation
    }));

    return {
      totalBookings,
      totalRevenue,
      cancellationRate: 0, // Would need a deleted bookings log to track this
      monthlyReservations,
    };
  }
}
