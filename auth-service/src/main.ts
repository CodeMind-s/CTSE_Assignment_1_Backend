import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.GRPC_PORT || '50050';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'staylike.auth',
        protoPath: join(__dirname, '../../../common/protos/auth.proto'),
        url: `0.0.0.0:${grpcPort}`,
        loader: {
          includeDirs: [join(__dirname, '../../../common/protos')],
        },
      },
    },
  );

  await app.listen();
  console.log(`Auth service is running on gRPC port ${grpcPort}`);
}
bootstrap();
