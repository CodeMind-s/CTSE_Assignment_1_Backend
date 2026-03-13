import { IsString, IsNotEmpty, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: ['guest', 'host'] })
  @IsOptional()
  @IsEnum(['guest', 'host'])
  role?: string;
}
