import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { RoomsService } from './rooms.service';

@Controller()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @GrpcMethod('RoomsService', 'CreateListing')
  async createListing(data: {
    hostId: string;
    title: string;
    city: string;
    description: string;
    price: number;
    maxGuests?: number;
  }) {
    return this.roomsService.createListing(data);
  }

  @GrpcMethod('RoomsService', 'GetListing')
  async getListing(data: { id: string }) {
    return this.roomsService.getListing(data.id);
  }

  @GrpcMethod('RoomsService', 'UpdateListing')
  async updateListing(data: {
    id: string;
    hostId: string;
    title?: string;
    city?: string;
    description?: string;
    price?: number;
    maxGuests?: number;
  }) {
    return this.roomsService.updateListing(data);
  }

  @GrpcMethod('RoomsService', 'DeleteListing')
  async deleteListing(data: { id: string; hostId: string }) {
    return this.roomsService.deleteListing(data);
  }

  @GrpcMethod('RoomsService', 'SearchListings')
  async searchListings(data: {
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
  }) {
    return this.roomsService.searchListings(data);
  }

  @GrpcMethod('RoomsService', 'CheckAvailability')
  async checkAvailability(data: {
    listingId: string;
    start: string;
    end: string;
  }) {
    return this.roomsService.checkAvailability(data);
  }

  @GrpcMethod('RoomsService', 'GetAvailability')
  async getAvailability(data: { id: string }) {
    return this.roomsService.getAvailability(data.id);
  }

  @GrpcMethod('RoomsService', 'BlockDates')
  async blockDates(data: {
    listingId: string;
    start: string;
    end: string;
    reservationId: string;
  }) {
    return this.roomsService.blockDates(data);
  }

  @GrpcMethod('RoomsService', 'UnblockDates')
  async unblockDates(data: {
    listingId: string;
    start: string;
    end: string;
    reservationId: string;
  }) {
    return this.roomsService.unblockDates(data);
  }

  @GrpcMethod('RoomsService', 'GetRoomCount')
  async getRoomCount() {
    return this.roomsService.getRoomCount();
  }

  @GrpcMethod('RoomsService', 'HealthCheck')
  async healthCheck() {
    return this.roomsService.healthCheck();
  }

  // ---- Admin gRPC handlers ----

  @GrpcMethod('RoomsService', 'SuspendListing')
  async suspendListing(data: { id: string }) {
    return this.roomsService.suspendListing(data.id);
  }

  @GrpcMethod('RoomsService', 'AdminDeleteListing')
  async adminDeleteListing(data: { id: string }) {
    return this.roomsService.adminDeleteListing(data.id);
  }

  @GrpcMethod('RoomsService', 'AdminSearchListings')
  async adminSearchListings(data: {
    page?: number;
    limit?: number;
    city?: string;
    status?: string;
    host?: string;
  }) {
    return this.roomsService.adminSearchListings(data);
  }

  @GrpcMethod('RoomsService', 'GetListingsByHost')
  async getListingsByHost(data: { hostId: string }) {
    return this.roomsService.getListingsByHost(data.hostId);
  }
}
