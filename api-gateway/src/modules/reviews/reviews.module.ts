import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'staylike-jwt-secret',
    }),
    ClientsModule.register([
      {
        name: 'REVIEW_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'staylike.review',
          protoPath: join(
            __dirname,
            '../../../../../common/protos/review.proto',
          ),
          url: `${process.env.REVIEW_SERVICE_HOST || 'localhost'}:${process.env.REVIEW_SERVICE_PORT || '50054'}`,
        },
      },
    ]),
  ],
  controllers: [ReviewsController],
})
export class ReviewsGatewayModule {}
