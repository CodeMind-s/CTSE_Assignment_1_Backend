import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const key = ctx.switchToHttp().getRequest().headers['x-service-key'];
    if (key !== this.config.get('INTERNAL_SERVICE_KEY'))
      throw new UnauthorizedException('Invalid service key');
    return true;
  }
}
