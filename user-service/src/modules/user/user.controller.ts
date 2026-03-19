import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserService } from './user.service';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: string;
  }) {
    return this.userService.createUser(data);
  }

  @GrpcMethod('UserService', 'GetUserByEmail')
  async getUserByEmail(data: { email: string }) {
    return this.userService.getUserByEmail(data.email);
  }

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: { id: string }) {
    return this.userService.getUserById(data.id);
  }

  @GrpcMethod('UserService', 'ValidateUserRole')
  async validateUserRole(data: { id: string; role: string }) {
    return this.userService.validateUserRole(data.id, data.role);
  }

  // ---- Admin gRPC handlers ----

  @GrpcMethod('UserService', 'GetAllUsers')
  async getAllUsers(data: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    suspended?: string;
  }) {
    return this.userService.getAllUsers(data);
  }

  @GrpcMethod('UserService', 'SuspendUser')
  async suspendUser(data: { id: string }) {
    return this.userService.suspendUser(data.id);
  }

  @GrpcMethod('UserService', 'UpdateUserRole')
  async updateUserRole(data: { id: string; role: string }) {
    return this.userService.updateUserRole(data.id, data.role);
  }

  @GrpcMethod('UserService', 'DeleteUser')
  async deleteUser(data: { id: string }) {
    return this.userService.deleteUser(data.id);
  }

  @GrpcMethod('UserService', 'GetUserCount')
  async getUserCount() {
    return this.userService.getUserCount();
  }
}
