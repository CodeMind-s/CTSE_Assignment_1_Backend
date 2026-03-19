import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'staylike-jwt-secret',
    }),
    ClientsModule.register([
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
  controllers: [NotificationsController],
})
export class NotificationsGatewayModule {}
