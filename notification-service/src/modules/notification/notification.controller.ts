import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { NotificationType } from './notification.schema';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  // Handles Buffer, string, or already-parsed object from NestJS Kafka transport
  private parseMessage(message: any): any {
    const raw = message?.value ?? message;
    if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString('utf8'));
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  }

  // ---- gRPC methods (called by api-gateway) ----

  @GrpcMethod('NotificationService', 'GetUserNotifications')
  getUserNotifications(data: { userId: string }) {
    return this.notificationService.getUserNotifications(data);
  }

  @GrpcMethod('NotificationService', 'MarkNotificationsRead')
  markNotificationsRead(data: { notificationIds: string[]; userId: string }) {
    return this.notificationService.markNotificationsRead(data);
  }

  @GrpcMethod('NotificationService', 'DeleteNotifications')
  deleteNotifications(data: { notificationIds: string[]; userId: string }) {
    return this.notificationService.deleteNotifications(data);
  }

  // ---- Admin gRPC handlers ----

  @GrpcMethod('NotificationService', 'GetAllNotifications')
  getAllNotifications(data: { page?: number; limit?: number; type?: string }) {
    return this.notificationService.getAllNotifications(data);
  }

  @GrpcMethod('NotificationService', 'RetryNotification')
  retryNotification(data: { id: string }) {
    return this.notificationService.retryNotification(data);
  }


  // ---- Kafka consumer (receives booking events from booking-service) ----

  @MessagePattern('booking-events')
  async handleBookingEvent(@Payload() message: any) {
    const data = this.parseMessage(message);
    this.logger.debug(`booking-events received: ${JSON.stringify(data)}`);

    const { type, guestId, roomTitle, reservationDate } = data;

    let title: string;
    let body: string;

    switch (type) {
      case 'BOOKING_CREATED':
        title = 'Booking Confirmed';
        body = `Your booking for "${roomTitle}" on ${reservationDate} has been confirmed.`;
        break;
      case 'BOOKING_UPDATED':
        title = 'Booking Updated';
        body = `Your booking for "${roomTitle}" has been updated.`;
        break;
      case 'BOOKING_DELETED':
        title = 'Booking Cancelled';
        body = `Your booking for "${roomTitle}" on ${reservationDate} has been cancelled.`;
        break;
      default:
        return;
    }

    await this.notificationService.createNotification({
      type: NotificationType.PRIVATE,
      userId: guestId,
      title,
      message: body,
    });
  }

  // ---- Kafka consumer: review-events ----

  @MessagePattern('review-events')
  async handleReviewEvent(@Payload() message: any) {
    const parsed = this.parseMessage(message);
    this.logger.log(`review-events received: ${JSON.stringify(parsed)}`);

    // NestJS ClientKafka wraps payload as { eventType, reviewData, hostId, guestId, timestamp }
    const { eventType, reviewData, hostId, guestId } = parsed;

    const { userName, listingId, rating, comment } = reviewData || {};

    let title: string;
    let body: string;
    let recipientId: string;

    switch (eventType) {
      case 'reviews.created':
        if (!guestId) {
          this.logger.warn(`review-events [${eventType}] skipped — guestId missing`);
          return;
        }
        recipientId = guestId;
        title = 'Review Submitted';
        body = `Your review (${rating}⭐ - ${comment || '(no comment)'}) has been submitted successfully.`;
        break;
      case 'reviews.updated':
        if (!hostId) {
          this.logger.warn(`review-events [${eventType}] skipped — hostId missing`);
          return;
        }
        recipientId = hostId;
        title = 'Review Updated';
        body = `Review updated by ${userName || 'a guest'}: ${rating}⭐ - ${comment || '(no comment)'}`;
        break;
      case 'reviews.deleted':
        if (!hostId) {
          this.logger.warn(`review-events [${eventType}] skipped — hostId missing`);
          return;
        }
        recipientId = hostId;
        title = 'Review Removed';
        body = `A review has been removed from listing ${listingId}`;
        break;
      default:
        this.logger.warn(`Unknown review event type: ${eventType}`);
        return;
    }

    await this.notificationService.createNotification({
      type: NotificationType.PRIVATE,
      userId: recipientId,
      title,
      message: body,
    });
    this.logger.log(`Notification created for user ${recipientId} [${eventType}]`);
  }
}
