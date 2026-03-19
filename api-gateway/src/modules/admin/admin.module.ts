import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'staylike-jwt-secret',
    }),
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'staylike.user',
          protoPath: join(
            __dirname,
            '../../../../../common/protos/user.proto',
          ),
          url: `${process.env.USER_SERVICE_HOST || 'localhost'}:${process.env.USER_SERVICE_PORT || '50051'}`,
        },
      },
      {
        name: 'ROOMS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'staylike.rooms',
          protoPath: join(
            __dirname,
            '../../../../../common/protos/rooms.proto',
          ),
          url: `${process.env.ROOMS_SERVICE_HOST || 'localhost'}:${process.env.ROOMS_SERVICE_PORT || '50052'}`,
        },
      },
      {
        name: 'BOOKING_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'staylike.booking',
          protoPath: join(
            __dirname,
            '../../../../../common/protos/booking.proto',
          ),
          url: `${process.env.BOOKING_SERVICE_HOST || 'localhost'}:${process.env.BOOKING_SERVICE_PORT || '50053'}`,
        },
      },
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'staylike.notification',
          protoPath: join(
            __dirname,
            '../../../../../common/protos/notification.proto',
          ),
          url: `${process.env.NOTIFICATION_SERVICE_HOST || 'localhost'}:${process.env.NOTIFICATION_SERVICE_PORT || '50055'}`,
        },
      },
    ]),
  ],
  controllers: [AdminController],
})
export class AdminGatewayModule {}
