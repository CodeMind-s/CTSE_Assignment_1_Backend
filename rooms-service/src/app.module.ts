import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from './modules/rooms/rooms.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017', {
      dbName: process.env.DB_NAME || 'rooms-db',
    }),
    RoomsModule,
  ],
})
export class AppModule {}
