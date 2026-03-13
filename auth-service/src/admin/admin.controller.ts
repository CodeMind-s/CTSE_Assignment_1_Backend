import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Admin — Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminStatsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'System KPIs — users, listings, reservations, revenue' })
  getStats() {
    return this.adminService.getStats();
  }
}

@ApiTags('Admin — Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated, filterable)' })
  getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('suspended') suspended?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search, role, suspended });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID with reservation count' })
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Toggle user suspended status' })
  toggleSuspend(@Param('id') id: string) {
    return this.adminService.toggleSuspend(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role (guest/host/admin)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateRole(id, dto.role);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user — cascades to listings + reservations' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}

@ApiTags('Admin — Listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminListingsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  @Get('listings')
  @ApiOperation({ summary: 'All listings (paginated, filterable by city/status/host)' })
  getListings(@Req() req: any) {
    const serviceUrl = this.configService.get<string>('LISTING_SERVICE_URL')!;
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    return this.adminService.proxyToService(serviceUrl, `/listings${qs}`, 'GET');
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Listing detail with booking history' })
  getListing(@Param('id') id: string) {
    const serviceUrl = this.configService.get<string>('LISTING_SERVICE_URL')!;
    return this.adminService.proxyToService(serviceUrl, `/listings/${id}`, 'GET');
  }

  @Patch('listings/:id/suspend')
  @ApiOperation({ summary: 'Toggle listing suspended status' })
  suspendListing(@Param('id') id: string) {
    const serviceUrl = this.configService.get<string>('LISTING_SERVICE_URL')!;
    return this.adminService.proxyToService(serviceUrl, `/listings/${id}/suspend`, 'PATCH');
  }

  @Delete('listings/:id')
  @ApiOperation({ summary: 'Force delete listing + cancel active reservations' })
  deleteListing(@Param('id') id: string) {
    const serviceUrl = this.configService.get<string>('LISTING_SERVICE_URL')!;
    return this.adminService.proxyToService(serviceUrl, `/listings/${id}`, 'DELETE');
  }
}

@ApiTags('Admin — Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminReservationsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  @Get('reservations')
  @ApiOperation({ summary: 'All reservations (paginated, filterable)' })
  getReservations(@Req() req: any) {
    const serviceUrl = this.configService.get<string>('RESERVATION_SERVICE_URL')!;
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    return this.adminService.proxyToService(serviceUrl, `/reservations${qs}`, 'GET');
  }

  @Patch('reservations/:id/force-cancel')
  @ApiOperation({ summary: 'Force cancel reservation (bypasses ownership check)' })
  forceCancelReservation(@Param('id') id: string) {
    const serviceUrl = this.configService.get<string>('RESERVATION_SERVICE_URL')!;
    return this.adminService.proxyToService(serviceUrl, `/reservations/${id}/force-cancel`, 'PATCH');
  }
}

@ApiTags('Admin — Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminNotificationsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  @Get('notifications')
  @ApiOperation({ summary: 'All notification logs (paginated)' })
  getNotifications(@Req() req: any) {
    const serviceUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL')!;
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    return this.adminService.proxyToService(serviceUrl, `/notifications${qs}`, 'GET');
  }

  @Post('notifications/:id/retry')
  @ApiOperation({ summary: 'Retry failed notification — re-trigger email' })
  retryNotification(@Param('id') id: string) {
    const serviceUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL')!;
    return this.adminService.proxyToService(serviceUrl, `/notifications/${id}/retry`, 'POST');
  }
}
