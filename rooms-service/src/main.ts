import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.GRPC_PORT || '50052';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'staylike.rooms',
        protoPath: join(__dirname, '../../../common/protos/rooms.proto'),
        url: `0.0.0.0:${grpcPort}`,
      },
    },
  );

  await app.listen();
  console.log(`Rooms service is running on gRPC port ${grpcPort}`);
}
bootstrap();
