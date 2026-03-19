import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  async onModuleInit() {
    this.kafka = new Kafka({
      clientId: 'booking-service',
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    });
    this.producer = this.kafka.producer();
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publishBookingEvent(event: {
    type: 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_DELETED';
    bookingId: string;
    guestId: string;
    roomTitle: string;
    reservationDate: string;
  }) {
    await this.producer.send({
      topic: 'booking-events',
      messages: [
        {
          key: event.bookingId,
          value: JSON.stringify({
            ...event,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
  }
}
