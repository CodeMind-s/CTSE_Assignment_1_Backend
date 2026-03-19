import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Review, ReviewSchema } from './review.schema';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
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
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
            connectionTimeout: 15000,
            requestTimeout: 30000,
            retry: {
              initialRetryTime: 300,
              maxRetryTime: 10000,
              multiplier: 2,
              retries: 8,
            },
          },
        },
      },
    ]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
