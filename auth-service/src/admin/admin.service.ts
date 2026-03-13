import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { User, UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get serviceKey(): string {
    return this.configService.get<string>('INTERNAL_SERVICE_KEY')!;
  }

  private get listingServiceUrl(): string {
    return this.configService.get<string>('LISTING_SERVICE_URL')!;
  }

  private get reservationServiceUrl(): string {
    return this.configService.get<string>('RESERVATION_SERVICE_URL')!;
  }

  private get notificationServiceUrl(): string {
    return this.configService.get<string>('NOTIFICATION_SERVICE_URL')!;
  }

  async getStats() {
    const totalUsers = await this.userModel.countDocuments();
    const totalHosts = await this.userModel.countDocuments({ role: 'host' });
    const suspendedUsers = await this.userModel.countDocuments({ suspended: true });

    let listingCount = 0;
    let reservationStats: any = {};

    try {
      const listingRes = await firstValueFrom(
        this.httpService.get(`${this.listingServiceUrl}/listings/count`, {
          headers: { 'x-service-key': this.serviceKey },
        }),
      );
      listingCount = listingRes.data?.count || listingRes.data || 0;
    } catch {
      // Service might be unavailable
    }

    try {
      const reservationRes = await firstValueFrom(
        this.httpService.get(`${this.reservationServiceUrl}/reservations/aggregate`, {
          headers: { 'x-service-key': this.serviceKey },
        }),
      );
      reservationStats = reservationRes.data || {};
    } catch {
      // Service might be unavailable
    }

    return {
      totalUsers,
      totalHosts,
      suspendedUsers,
      totalListings: listingCount,
      reservationStats,
    };
  }

  async getUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    suspended?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.role) {
      filter.role = query.role;
    }

    if (query.suspended !== undefined) {
      filter.suspended = query.suspended === 'true';
    }

    const [users, total] = await Promise.all([
      this.userModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let reservationCount = 0;
    try {
      const res = await firstValueFrom(
        this.httpService.get(
          `${this.reservationServiceUrl}/reservations/count?userId=${id}`,
          { headers: { 'x-service-key': this.serviceKey } },
        ),
      );
      reservationCount = res.data?.count || res.data || 0;
    } catch {
      // Service might be unavailable
    }

    return {
      user,
      reservationCount,
    };
  }

  async toggleSuspend(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.suspended = !user.suspended;
    await user.save();

    return { message: `User ${user.suspended ? 'suspended' : 'unsuspended'}`, user };
  }

  async updateRole(id: string, role: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if this is the only admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await this.userModel.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the only admin');
      }
    }

    user.role = role;
    await user.save();

    return { message: 'Role updated', user };
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete user's listings
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.listingServiceUrl}/listings/user/${id}`,
          { headers: { 'x-service-key': this.serviceKey } },
        ),
      );
    } catch {
      // Service might be unavailable
    }

    // Cancel user's reservations
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.reservationServiceUrl}/reservations/user/${id}`,
          { headers: { 'x-service-key': this.serviceKey } },
        ),
      );
    } catch {
      // Service might be unavailable
    }

    await this.userModel.findByIdAndDelete(id);

    return { message: 'User deleted' };
  }

  // Proxy methods for admin endpoints to other services
  async proxyToService(
    serviceUrl: string,
    path: string,
    method: string,
    body?: any,
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url: `${serviceUrl}${path}`,
          method,
          data: body,
          headers: {
            'x-service-key': this.serviceKey,
            'x-admin': 'true',
            'content-type': 'application/json',
          },
          timeout: 30000,
        }),
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
