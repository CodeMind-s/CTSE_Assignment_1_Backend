import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { ListingsController } from './listings.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'staylike-jwt-secret',
    }),
    ClientsModule.register([
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
    ]),
  ],
  controllers: [ListingsController],
})
export class ListingsGatewayModule {}
