import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  });

  app.setGlobalPrefix('api/v1');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('StayLike API')
    .setDescription('StayLike — Hotel Booking Microservices API Gateway')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('Auth', 'Registration and login')
    .addTag('Listings', 'Search and manage property listings')
    .addTag('Bookings', 'Create and manage reservations')
    .addTag('Reviews', 'Submit and view reviews')
    .addTag('Notifications', 'User notification management')
    .addTag('Health', 'Service health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3400;
  await app.listen(port);
  console.log(`API Gateway is running on http://0.0.0.0:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs#/`);
}
bootstrap();
