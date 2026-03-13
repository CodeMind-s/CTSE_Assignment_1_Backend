import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ enum: ['guest', 'host', 'admin'] })
  @IsEnum(['guest', 'host', 'admin'])
  role: string;
}
