import { Controller, Get, Post, Patch, Delete, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GatewayService } from './gateway.service';

@ApiTags('Gateway — Listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class GatewayListingsController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly configService: ConfigService,
  ) {}

  private proxy(req: any) {
    const serviceUrl = this.configService.get<string>('LISTING_SERVICE_URL')!;
    const user = req.user;
    return this.gatewayService.proxyRequest(
      serviceUrl, req.url, req.method, req.body, req.headers,
      user.userId, user.role,
    );
  }

  @Get('listings')
  @ApiOperation({ summary: 'Search listings (proxied to Listing Service)' })
  getListings(@Req() req: any) { return this.proxy(req); }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing by ID (proxied)' })
  getListing(@Req() req: any) { return this.proxy(req); }

  @Post('listings')
  @ApiOperation({ summary: 'Create listing — host only (proxied)' })
  createListing(@Req() req: any) { return this.proxy(req); }

  @Patch('listings/:id')
  @ApiOperation({ summary: 'Update listing — owner only (proxied)' })
  updateListing(@Req() req: any) { return this.proxy(req); }

  @Delete('listings/:id')
  @ApiOperation({ summary: 'Delete listing — owner only (proxied)' })
  deleteListing(@Req() req: any) { return this.proxy(req); }

  @Get('listings/:id/availability')
  @ApiOperation({ summary: 'Check listing availability (proxied)' })
  getAvailability(@Req() req: any) { return this.proxy(req); }
}

@ApiTags('Gateway — Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class GatewayReservationsController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly configService: ConfigService,
  ) {}

  private proxy(req: any) {
    const serviceUrl = this.configService.get<string>('RESERVATION_SERVICE_URL')!;
    const user = req.user;
    return this.gatewayService.proxyRequest(
      serviceUrl, req.url, req.method, req.body, req.headers,
      user.userId, user.role,
    );
  }

  @Post('reservations')
  @ApiOperation({ summary: 'Create reservation (proxied to Reservation Service)' })
  createReservation(@Req() req: any) { return this.proxy(req); }

  @Get('reservations')
  @ApiOperation({ summary: 'Get my reservations (proxied)' })
  getReservations(@Req() req: any) { return this.proxy(req); }

  @Get('reservations/:id')
  @ApiOperation({ summary: 'Get reservation by ID (proxied)' })
  getReservation(@Req() req: any) { return this.proxy(req); }

  @Patch('reservations/:id/cancel')
  @ApiOperation({ summary: 'Cancel reservation (proxied)' })
  cancelReservation(@Req() req: any) { return this.proxy(req); }

  @Get('reservations/host/:hostId')
  @ApiOperation({ summary: 'Get reservations for host (proxied)' })
  getHostReservations(@Req() req: any) { return this.proxy(req); }
}
