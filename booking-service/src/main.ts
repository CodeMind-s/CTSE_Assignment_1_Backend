import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.GRPC_PORT || '50053';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'staylike.booking',
        protoPath: join(__dirname, '../../../common/protos/booking.proto'),
        url: `0.0.0.0:${grpcPort}`,
      },
    },
  );

  await app.listen();
  console.log(`Booking service is running on gRPC port ${grpcPort}`);
}
bootstrap();
