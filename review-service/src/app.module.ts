import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewModule } from './modules/review/review.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017', {
      dbName: process.env.DB_NAME || 'review-db',
    }),
    ReviewModule,
  ],
})
export class AppModule {}
