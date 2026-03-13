import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { AdminService } from './admin.service';
import {
  AdminStatsController,
  AdminUsersController,
  AdminListingsController,
  AdminReservationsController,
  AdminNotificationsController,
} from './admin.controller';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    HttpModule,
  ],
  providers: [AdminService],
  controllers: [
    AdminStatsController,
    AdminUsersController,
    AdminListingsController,
    AdminReservationsController,
    AdminNotificationsController,
  ],
})
export class AdminModule {}
