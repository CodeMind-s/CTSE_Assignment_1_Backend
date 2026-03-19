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
  OnModuleInit,
  Inject,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, Observable } from "rxjs";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/guards/roles.guard";

// ---- gRPC interfaces ----

interface UserServiceGrpc {
  getAllUsers(data: any): Observable<any>;
  getUserById(data: any): Observable<any>;
  suspendUser(data: any): Observable<any>;
  updateUserRole(data: any): Observable<any>;
  deleteUser(data: any): Observable<any>;
  getUserCount(data: any): Observable<any>;
}

interface RoomsServiceGrpc {
  getListing(data: any): Observable<any>;
  adminSearchListings(data: any): Observable<any>;
  suspendListing(data: any): Observable<any>;
  adminDeleteListing(data: any): Observable<any>;
  getListingsByHost(data: any): Observable<any>;
  getRoomCount(data: any): Observable<any>;
}

interface BookingServiceGrpc {
  getAllBookings(data: any): Observable<any>;
  getBookingsByRoom(data: any): Observable<any>;
  forceCancelBooking(data: any): Observable<any>;
  getBookingStats(data: any): Observable<any>;
}

interface NotificationServiceGrpc {
  getAllNotifications(data: any): Observable<any>;
  retryNotification(data: any): Observable<any>;
}

@ApiTags("Admin")
@ApiBearerAuth("JWT")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin")
export class AdminController implements OnModuleInit {
  private userService: UserServiceGrpc;
  private roomsService: RoomsServiceGrpc;
  private bookingService: BookingServiceGrpc;
  private notificationService: NotificationServiceGrpc;

  constructor(
    @Inject("USER_SERVICE") private readonly userClient: ClientGrpc,
    @Inject("ROOMS_SERVICE") private readonly roomsClient: ClientGrpc,
    @Inject("BOOKING_SERVICE") private readonly bookingClient: ClientGrpc,
    @Inject("NOTIFICATION_SERVICE")
    private readonly notificationClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService =
      this.userClient.getService<UserServiceGrpc>("UserService");
    this.roomsService =
      this.roomsClient.getService<RoomsServiceGrpc>("RoomsService");
    this.bookingService =
      this.bookingClient.getService<BookingServiceGrpc>("BookingService");
    this.notificationService =
      this.notificationClient.getService<NotificationServiceGrpc>(
        "NotificationService",
      );
  }

  // ══════════════════════════ 1. STATS ══════════════════════════

  @Get("stats")
  @Roles("admin")
  @ApiOperation({
    summary:
      "System KPIs: user/host/listing/reservation counts, revenue, monthly stats",
  })
  @ApiResponse({ status: 200, description: "System statistics" })
  async getStats() {
    try {
      const [userCount, roomCount, bookingStats] = await Promise.all([
        firstValueFrom(this.userService.getUserCount({})),
        firstValueFrom(this.roomsService.getRoomCount({})),
        firstValueFrom(this.bookingService.getBookingStats({})),
      ]);

      const hostCount =
        userCount.byRole?.find((r: any) => r.role === "host")?.count || 0;

      return {
        userCount: userCount.total,
        hostCount,
        listingCount: roomCount.total,
        reservationCount: bookingStats.totalBookings,
        totalRevenue: bookingStats.totalRevenue,
        cancellationRate: bookingStats.cancellationRate,
        monthlyReservations: bookingStats.monthlyReservations || [],
        revenueByMonth: bookingStats.monthlyReservations || [],
      };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to fetch stats",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ══════════════════════════ 2-6. USERS ══════════════════════════

  @Get("users")
  @Roles("admin")
  @ApiOperation({
    summary: "All users paginated with search, role, and suspended filters",
  })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "role", required: false, enum: ["guest", "host", "admin"] })
  @ApiQuery({ name: "suspended", required: false, enum: ["true", "false"] })
  @ApiResponse({ status: 200, description: "Paginated user list" })
  async getUsers(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("role") role?: string,
    @Query("suspended") suspended?: string,
  ) {
    try {
      return await firstValueFrom(
        this.userService.getAllUsers({
          page: page ? parseInt(page) : 1,
          limit: limit ? parseInt(limit) : 20,
          search: search || "",
          role: role || "",
          suspended: suspended || "",
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to fetch users",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("users/:id")
  @Roles("admin")
  @ApiOperation({
    summary: "User profile + reservation count + listings if host",
  })
  @ApiResponse({ status: 200, description: "User detail with stats" })
  async getUserById(@Param("id") id: string) {
    try {
      const [user, bookingStats, listings] = await Promise.all([
        firstValueFrom(this.userService.getUserById({ id })),
        firstValueFrom(
          this.bookingService.getAllBookings({
            board: "",
            reservationDate: "",
            offset: 0,
            limit: 1,
          }),
        ),
        firstValueFrom(this.roomsService.getListingsByHost({ hostId: id })),
      ]);

      return {
        ...user,
        reservationCount: bookingStats.total || 0,
        listings: listings.listings || [],
        listingCount: listings.total || 0,
      };
    } catch (error) {
      throw new HttpException(
        error.message || "User not found",
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Patch("users/:id/suspend")
  @Roles("admin")
  @ApiOperation({ summary: "Toggle user.suspended — true/false" })
  @ApiResponse({ status: 200, description: "User suspended status toggled" })
  async suspendUser(@Param("id") id: string) {
    try {
      return await firstValueFrom(this.userService.suspendUser({ id }));
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to suspend user",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch("users/:id/role")
  @Roles("admin")
  @ApiOperation({
    summary: "Update role: body { role: 'guest'|'host'|'admin' }",
  })
  @ApiBody({
    schema: {
      properties: {
        role: { type: "string", enum: ["guest", "host", "admin"] },
      },
    },
  })
  @ApiResponse({ status: 200, description: "User role updated" })
  async updateUserRole(
    @Param("id") id: string,
    @Body() body: { role: string },
  ) {
    try {
      return await firstValueFrom(
        this.userService.updateUserRole({ id, role: body.role }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to update role",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete("users/:id")
  @Roles("admin")
  @ApiOperation({ summary: "Delete user — soft-delete (sets active=false)" })
  @ApiResponse({ status: 200, description: "User deleted" })
  async deleteUser(@Param("id") id: string) {
    try {
      return await firstValueFrom(this.userService.deleteUser({ id }));
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to delete user",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ══════════════════════════ 7-10. LISTINGS ══════════════════════════

  @Get("listings")
  @Roles("admin")
  @ApiOperation({
    summary: "All listings paginated with city, status, and host filters",
  })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "city", required: false })
  @ApiQuery({ name: "status", required: false, enum: ["active", "suspended"] })
  @ApiQuery({ name: "host", required: false })
  @ApiResponse({ status: 200, description: "Paginated listing list" })
  async getListings(
    @Query("page") page?: string,
    @Query("city") city?: string,
    @Query("status") status?: string,
    @Query("host") host?: string,
  ) {
    try {
      return await firstValueFrom(
        this.roomsService.adminSearchListings({
          page: page ? parseInt(page) : 1,
          limit: 20,
          city: city || "",
          status: status || "",
          host: host || "",
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to fetch listings",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("listings/:id")
  @Roles("admin")
  @ApiOperation({ summary: "Listing detail with booking history" })
  @ApiResponse({ status: 200, description: "Listing detail with bookings" })
  async getListingById(@Param("id") id: string) {
    try {
      const [listing, bookings] = await Promise.all([
        firstValueFrom(this.roomsService.getListing({ id })),
        firstValueFrom(this.bookingService.getBookingsByRoom({ roomId: id })),
      ]);

      return {
        ...listing,
        bookingHistory: bookings.bookings || [],
        totalBookings: bookings.total || 0,
      };
    } catch (error) {
      throw new HttpException(
        error.message || "Listing not found",
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Patch("listings/:id/suspend")
  @Roles("admin")
  @ApiOperation({ summary: "Toggle listing suspended status" })
  @ApiResponse({ status: 200, description: "Listing suspended status toggled" })
  async suspendListing(@Param("id") id: string) {
    try {
      return await firstValueFrom(this.roomsService.suspendListing({ id }));
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to suspend listing",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete("listings/:id")
  @Roles("admin")
  @ApiOperation({
    summary: "Force delete listing + cancel active reservations",
  })
  @ApiResponse({ status: 200, description: "Listing deleted" })
  async deleteListing(@Param("id") id: string) {
    try {
      return await firstValueFrom(this.roomsService.adminDeleteListing({ id }));
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to delete listing",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ══════════════════════════ 11-13. RESERVATIONS ══════════════════════════

  @Get("reservations")
  @Roles("admin")
  @ApiOperation({ summary: "All reservations with status, date filters" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiResponse({ status: 200, description: "Paginated reservation list" })
  async getReservations(
    @Query("page") page?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    try {
      const offset = page ? (parseInt(page) - 1) * 20 : 0;
      const result = await firstValueFrom(
        this.bookingService.getAllBookings({
          board: status || "",
          reservationDate: from || "",
          offset,
          limit: 20,
        }),
      );
      return {
        success: true,
        data: result.bookings,
        pagination: {
          total: result.total,
          offset: result.offset,
          limit: result.limit,
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to fetch reservations",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch("reservations/:id/force-cancel")
  @Roles("admin")
  @ApiOperation({ summary: "Admin force-cancel bypassing ownership check" })
  @ApiResponse({ status: 200, description: "Reservation force-cancelled" })
  async forceCancelReservation(@Param("id") id: string) {
    try {
      return await firstValueFrom(
        this.bookingService.forceCancelBooking({ bookingId: id }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to force-cancel reservation",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ══════════════════════════ 14-15. NOTIFICATIONS ══════════════════════════

  @Get("notifications")
  @Roles("admin")
  @ApiOperation({ summary: "All notification logs with filters" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "type", required: false, enum: ["private", "broadcast"] })
  @ApiResponse({ status: 200, description: "Paginated notification list" })
  async getNotifications(
    @Query("page") page?: string,
    @Query("type") type?: string,
  ) {
    try {
      return await firstValueFrom(
        this.notificationService.getAllNotifications({
          page: page ? parseInt(page) : 1,
          limit: 20,
          type: type || "",
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to fetch notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("notifications/:id/retry")
  @Roles("admin")
  @ApiOperation({ summary: "Retry a failed notification — re-trigger" })
  @ApiResponse({ status: 200, description: "Notification retried" })
  async retryNotification(@Param("id") id: string) {
    try {
      return await firstValueFrom(
        this.notificationService.retryNotification({ id }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to retry notification",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
