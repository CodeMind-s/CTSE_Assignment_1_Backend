import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GatewayService } from './gateway.service';
import { GatewayListingsController, GatewayReservationsController } from './gateway.controller';

@Module({
  imports: [HttpModule],
  providers: [GatewayService],
  controllers: [GatewayListingsController, GatewayReservationsController],
})
export class GatewayModule {}
