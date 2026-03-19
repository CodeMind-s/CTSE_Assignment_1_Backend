import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SvcKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const svcKey = request.headers['x-svc-key'] as string;
    const expectedKey = process.env.SVC_KEY || 'staylike-svc-secret-change-in-prod';

    if (!svcKey || svcKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing service key');
    }

    return true;
  }
}
