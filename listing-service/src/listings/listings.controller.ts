import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingDto } from './dto/search-listing.dto';
import { BlockDatesDto } from './dto/block-dates.dto';
import { ServiceKeyGuard } from '../common/guards/service-key.guard';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Search listings' })
  search(@Query() dto: SearchListingDto) {
    return this.listingsService.search(dto, false);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get listing counts (internal)' })
  @UseGuards(ServiceKeyGuard)
  getCount() {
    return this.listingsService.getCount();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listing by ID' })
  findById(@Param('id') id: string) {
    return this.listingsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new listing' })
  create(@Body() dto: CreateListingDto, @Req() req: Request) {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    if (!userId) {
      throw new ForbiddenException('User identity required');
    }
    if (userRole !== 'host') {
      throw new ForbiddenException('Only hosts can create listings');
    }
    return this.listingsService.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a listing' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @Req() req: Request,
  ) {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new ForbiddenException('User identity required');
    }
    return this.listingsService.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a listing' })
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new ForbiddenException('User identity required');
    }
    return this.listingsService.remove(id, userId);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get listing availability' })
  @ApiQuery({ name: 'checkIn', required: false })
  @ApiQuery({ name: 'checkOut', required: false })
  getAvailability(
    @Param('id') id: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
  ) {
    return this.listingsService.getAvailability(id, checkIn, checkOut);
  }

  @Patch(':id/block-dates')
  @ApiOperation({ summary: 'Block dates for a listing (internal)' })
  @UseGuards(ServiceKeyGuard)
  blockDates(@Param('id') id: string, @Body() dto: BlockDatesDto) {
    return this.listingsService.blockDates(id, dto);
  }

  @Patch(':id/unblock-dates')
  @ApiOperation({ summary: 'Unblock dates for a listing (internal)' })
  @UseGuards(ServiceKeyGuard)
  unblockDates(@Param('id') id: string, @Body() dto: BlockDatesDto) {
    return this.listingsService.unblockDates(id, dto);
  }
}
