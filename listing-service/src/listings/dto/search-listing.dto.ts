import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchListingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Check-in date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  checkIn?: string;

  @ApiPropertyOptional({ description: 'Check-out date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  checkOut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  guests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 12;

  @ApiPropertyOptional({ description: 'Text search query' })
  @IsOptional()
  @IsString()
  search?: string;
}
