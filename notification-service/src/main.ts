import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const grpcPort = process.env.GRPC_PORT || '50055';
  const kafkaBrokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');

  // Hybrid app: gRPC server + Kafka consumer
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'staylike.notification',
      protoPath: join(__dirname, '../../../common/protos/notification.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'notification-service',
        brokers: kafkaBrokers,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        retry: { initialRetryTime: 300, retries: 8 },
      },
      consumer: {
        groupId: 'notification-service-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        allowAutoTopicCreation: true,
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  });

  await app.startAllMicroservices();
  console.log(`Notification service gRPC on port ${grpcPort}`);
  console.log(`Notification service Kafka consumer connected`);
}
bootstrap();
