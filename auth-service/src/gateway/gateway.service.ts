import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async proxyRequest(
    serviceUrl: string,
    path: string,
    method: string,
    body: any,
    headers: Record<string, string>,
    userId: string,
    userRole: string,
  ) {
    const url = `${serviceUrl}${path}`;

    const proxyHeaders: Record<string, string> = {
      'content-type': headers['content-type'] || 'application/json',
      'x-service-key': this.configService.get<string>('INTERNAL_SERVICE_KEY')!,
      'x-user-id': userId,
      'x-user-role': userRole,
    };

    if (headers['authorization']) {
      proxyHeaders['authorization'] = headers['authorization'];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url,
          method,
          data: body,
          headers: proxyHeaders,
          timeout: 30000,
        }),
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new HttpException(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
