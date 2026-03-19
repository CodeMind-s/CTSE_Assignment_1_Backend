import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'staylike-jwt-secret',
    }),
    ClientsModule.register([
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
    ]),
  ],
  controllers: [BookingsController],
})
export class BookingsGatewayModule {}
