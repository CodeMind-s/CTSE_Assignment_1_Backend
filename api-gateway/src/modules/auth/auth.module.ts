import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'staylike-jwt-secret',
    }),
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'staylike.auth',
          protoPath: join(
            __dirname,
            '../../../../../common/protos/auth.proto',
          ),
          url: `${process.env.AUTH_SERVICE_HOST || 'localhost'}:${process.env.AUTH_SERVICE_PORT || '50050'}`,
          loader: {
            includeDirs: [
              join(__dirname, '../../../../../common/protos'),
            ],
          },
        },
      },
    ]),
  ],
  controllers: [AuthController],
})
export class AuthGatewayModule {}
