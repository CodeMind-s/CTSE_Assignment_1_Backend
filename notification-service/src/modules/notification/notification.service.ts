import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async createNotification(data: {
    type?: NotificationType;
    userId: string;
    title: string;
    message: string;
  }) {
    const notification = new this.notificationModel({
      type: data.type || NotificationType.PRIVATE,
      userId: data.userId,
      title: data.title,
      message: data.message,
      is_read: false,
    });
    return notification.save();
  }

  async getUserNotifications(data: { userId: string }) {
    const notifications = await this.notificationModel
      .find({ userId: data.userId })
      .sort({ createdAt: -1 })
      .exec();

    return {
      notifications: notifications.map((n) => this.toProtoItem(n)),
    };
  }

  async markNotificationsRead(data: { notificationIds: string[]; userId: string }) {
    await this.notificationModel.updateMany(
      { _id: { $in: data.notificationIds }, userId: data.userId },
      { $set: { is_read: true } },
    );
    return { ok: true, message: 'Notifications marked as read' };
  }

  async deleteNotifications(data: { notificationIds: string[]; userId: string }) {
    await this.notificationModel.deleteMany({
      _id: { $in: data.notificationIds },
      userId: data.userId,
    });
    return { ok: true, message: 'Notifications deleted' };
  }

  // ---- Admin methods ----

  async getAllNotifications(data: {
    page?: number;
    limit?: number;
    type?: string;
  }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (data.type) {
      filter.type = data.type;
    }

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      notifications: notifications.map((n) => this.toProtoItem(n)),
      total,
      page,
      limit,
    };
  }

  async retryNotification(data: { id: string }) {
    const original = await this.notificationModel.findById(data.id);
    if (!original) {
      return { ok: false, message: 'Notification not found' };
    }

    // Re-create the notification (trigger re-delivery)
    const notification = new this.notificationModel({
      type: original.type,
      userId: original.userId,
      title: `[Retry] ${original.title}`,
      message: original.message,
      is_read: false,
    });
    await notification.save();

    return { ok: true, message: 'Notification retried successfully' };
  }

  private toProtoItem(n: NotificationDocument) {
    return {
      id: (n as any)._id.toString(),
      type: n.type,
      userId: n.userId,
      title: n.title,
      message: n.message,
      isRead: n.is_read,
      createdAt: (n as any).createdAt?.toISOString() || '',
      updatedAt: (n as any).updatedAt?.toISOString() || '',
    };
  }
}
