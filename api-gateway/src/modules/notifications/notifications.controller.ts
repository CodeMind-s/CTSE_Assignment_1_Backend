import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
  OnModuleInit,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  MarkNotificationsReadDto,
  DeleteNotificationsDto,
  NotificationsListResponseDto,
  GenericResponseDto,
} from '../../common/dto';

interface NotificationServiceGrpc {
  getUserNotifications(data: any): Observable<any>;
  markNotificationsRead(data: any): Observable<any>;
  deleteNotifications(data: any): Observable<any>;
}

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController implements OnModuleInit {
  private notificationService: NotificationServiceGrpc;

  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.notificationService =
      this.notificationClient.getService<NotificationServiceGrpc>('NotificationService');
  }

  // GET /notifications/me — All roles
  @Get('me')
  @ApiOperation({ summary: "Get authenticated user's notifications" })
  @ApiResponse({ status: 200, description: 'User notifications', type: NotificationsListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyNotifications(@Req() req: any) {
    try {
      return await firstValueFrom(
        this.notificationService.getUserNotifications({ userId: req.user.userId }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH /notifications/read — Mark multiple as read
  @Patch('read')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiBody({ type: MarkNotificationsReadDto })
  @ApiResponse({ status: 200, description: 'Notifications marked as read', type: GenericResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(@Req() req: any, @Body() body: MarkNotificationsReadDto) {
    try {
      return await firstValueFrom(
        this.notificationService.markNotificationsRead({
          notificationIds: body.notificationIds,
          userId: req.user.userId,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to mark notifications as read',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // DELETE /notifications/me — Delete multiple notifications
  @Delete('me')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @ApiBody({ type: DeleteNotificationsDto })
  @ApiResponse({ status: 200, description: 'Notifications deleted', type: GenericResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteNotifications(@Req() req: any, @Body() body: DeleteNotificationsDto) {
    try {
      return await firstValueFrom(
        this.notificationService.deleteNotifications({
          notificationIds: body.notificationIds,
          userId: req.user.userId,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete notifications',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
