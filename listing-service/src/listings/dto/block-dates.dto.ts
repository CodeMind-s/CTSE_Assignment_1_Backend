import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class BlockDatesDto {
  @ApiProperty({ description: 'Start date string (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  start: string;

  @ApiProperty({ description: 'End date string (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  end: string;
}
