import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

export interface ReviewEventPayload {
  type: 'REVIEW_CREATED' | 'REVIEW_UPDATED' | 'REVIEW_DELETED';
  reviewId: string;
  hostId: string;
  userId?: string;
  userName?: string;
  listingId?: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  async onModuleInit() {
    this.kafka = new Kafka({
      clientId: 'review-service',
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: { initialRetryTime: 300, retries: 8 },
    });
    this.producer = this.kafka.producer();
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (err) {
      // Don't crash the service — producer will reconnect on first publish
      this.logger.error(`Kafka producer failed to connect on startup: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect().catch(() => {});
  }

  async publishReviewEvent(payload: ReviewEventPayload): Promise<void> {
    const message = {
      topic: 'review-events',
      messages: [
        {
          key: payload.reviewId,
          value: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
        },
      ],
    };

    try {
      await this.producer.send(message);
    } catch (err) {
      this.logger.error(`Publish failed [${payload.type}]: ${err.message} — reconnecting`);
      try {
        await this.producer.disconnect().catch(() => {});
        await this.producer.connect();
        await this.producer.send(message);
        this.logger.log(`Retry publish succeeded [${payload.type}]`);
      } catch (retryErr) {
        this.logger.error(`Retry also failed [${payload.type}]: ${retryErr.message}`);
      }
    }
  }
}
