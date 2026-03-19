import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// --- Auth DTOs ---

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'securePass123' })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ example: 'guest', enum: ['guest', 'host', 'admin'], default: 'guest' })
  role?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'securePass123' })
  password: string;
}

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() role: string;
  @ApiProperty() active: boolean;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}

// --- Listing DTOs ---

export class CreateListingDto {
  @ApiProperty({ example: 'Beach House' })
  title: string;

  @ApiProperty({ example: 'Colombo' })
  city: string;

  @ApiPropertyOptional({ example: 'Beautiful ocean-view villa' })
  description?: string;

  @ApiProperty({ example: 150 })
  price: number;

  @ApiPropertyOptional({ example: 2 })
  maxGuests?: number;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ example: 'Updated Beach House' })
  title?: string;

  @ApiPropertyOptional({ example: 'Kandy' })
  city?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  description?: string;

  @ApiPropertyOptional({ example: 200 })
  price?: number;

  @ApiPropertyOptional({ example: 4 })
  maxGuests?: number;
}

export class ListingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() hostId: string;
  @ApiProperty() title: string;
  @ApiProperty() city: string;
  @ApiProperty() description: string;
  @ApiProperty() price: number;
  @ApiProperty() maxGuests: number;
  @ApiProperty({ type: [String] }) images: string[];
  @ApiProperty() active: boolean;
}

export class SearchResponseDto {
  @ApiProperty({ type: [ListingResponseDto] })
  listings: ListingResponseDto[];

  @ApiProperty() total: number;
}

export class BlockedDateDto {
  @ApiProperty() start: string;
  @ApiProperty() end: string;
  @ApiProperty() reservationId: string;
}

export class AvailabilityResponseDto {
  @ApiProperty({ type: [BlockedDateDto] })
  blockedDates: BlockedDateDto[];
}

export class CityCountDto {
  @ApiProperty() city: string;
  @ApiProperty() count: number;
}

export class RoomCountResponseDto {
  @ApiProperty() total: number;
  @ApiProperty({ type: [CityCountDto] }) byCity: CityCountDto[];
}

// --- Booking DTOs ---

export class CreateBookingDto {
  @ApiProperty({ example: '2026-04-15' })
  reservationDate: string;

  @ApiProperty({ example: '14:00' })
  checkInTime: string;

  @ApiProperty({ example: '11:00' })
  checkOutTime: string;

  @ApiProperty({ example: 2 })
  memberCount: number;

  @ApiProperty({ example: 'full', enum: ['full', 'half'] })
  board: string;
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: '2026-04-20' })
  reservationDate?: string;

  @ApiPropertyOptional({ example: '15:00' })
  checkInTime?: string;

  @ApiPropertyOptional({ example: '10:00' })
  checkOutTime?: string;

  @ApiPropertyOptional({ example: 3 })
  memberCount?: number;

  @ApiPropertyOptional({ example: 'half', enum: ['full', 'half'] })
  board?: string;
}

export class PopulatedUserDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() role: string;
}

export class PopulatedRoomDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() city: string;
  @ApiProperty() description: string;
  @ApiProperty() price: number;
}

export class BookingItemDto {
  @ApiProperty() id: string;
  @ApiProperty() guestId: string;
  @ApiProperty() roomId: string;
  @ApiProperty() hostId: string;
  @ApiProperty() reservationDate: string;
  @ApiProperty() checkInTime: string;
  @ApiProperty() checkOutTime: string;
  @ApiProperty() memberCount: number;
  @ApiProperty() board: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiPropertyOptional({ type: PopulatedUserDto }) guest?: PopulatedUserDto;
  @ApiPropertyOptional({ type: PopulatedRoomDto }) room?: PopulatedRoomDto;
  @ApiPropertyOptional({ type: PopulatedUserDto }) host?: PopulatedUserDto;
}

export class BookingResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty() message: string;
  @ApiProperty({ type: BookingItemDto }) data: BookingItemDto;
}

export class PaginationDto {
  @ApiProperty() total: number;
  @ApiProperty() offset: number;
  @ApiProperty() limit: number;
}

export class BookingsListResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty({ type: [BookingItemDto] }) data: BookingItemDto[];
  @ApiProperty({ type: PaginationDto }) pagination: PaginationDto;
}

// --- Notification DTOs ---

export class MarkNotificationsReadDto {
  @ApiProperty({ type: [String], example: ['id1', 'id2'] })
  notificationIds: string[];
}

export class DeleteNotificationsDto {
  @ApiProperty({ type: [String], example: ['id1', 'id2'] })
  notificationIds: string[];
}

export class NotificationItemDto {
  @ApiProperty() id: string;
  @ApiProperty() type: string;
  @ApiProperty() userId: string;
  @ApiProperty() title: string;
  @ApiProperty() message: string;
  @ApiProperty() isRead: boolean;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class NotificationsListResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  notifications: NotificationItemDto[];
}

// --- Review DTOs ---

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ example: 'Amazing stay! Highly recommend.' })
  comment?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  rating?: number;

  @ApiPropertyOptional({ example: 'Updated comment.' })
  comment?: string;
}

export class ReviewerDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class ReviewBookingDto {
  @ApiProperty() id: string;
  @ApiProperty() guestId: string;
  @ApiProperty() checkInTime: string;
  @ApiProperty() checkOutTime: string;
  @ApiProperty() roomId: string;
  @ApiProperty() reservationDate: string;
}

export class ReviewRoomDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() city: string;
  @ApiProperty() price: number;
}

export class ReviewItemDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() listingId: string;
  @ApiProperty() bookingId: string;
  @ApiProperty() rating: number;
  @ApiProperty() comment: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiPropertyOptional({ type: ReviewerDto }) user?: ReviewerDto;
  @ApiPropertyOptional({ type: ReviewBookingDto }) booking?: ReviewBookingDto;
  @ApiPropertyOptional({ type: ReviewRoomDto }) room?: ReviewRoomDto;
}

export class ReviewResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty() message: string;
  @ApiProperty({ type: ReviewItemDto }) data: ReviewItemDto;
}

export class ReviewsListResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty({ type: [ReviewItemDto] }) data: ReviewItemDto[];
  @ApiProperty({ type: PaginationDto }) pagination: PaginationDto;
}

// --- Generic DTOs ---

export class GenericResponseDto {
  @ApiProperty() ok: boolean;
  @ApiProperty() message: string;
}

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' }) status: string;
  @ApiProperty({ example: 'api-gateway' }) service: string;
  @ApiProperty() timestamp: string;
}
