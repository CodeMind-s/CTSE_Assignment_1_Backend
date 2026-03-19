import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthResponseDto } from '../../common/dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API Gateway health' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthResponseDto })
  check() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }
}
