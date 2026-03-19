import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: string;
  }) {
    const existing = await this.userModel.findOne({ email: data.email });
    if (existing) {
      throw new Error('User with this email already exists');
    }

    const user = new this.userModel({
      email: data.email,
      password: data.passwordHash,
      name: data.name,
      role: data.role || 'guest',
    });
    const saved = await user.save();
    return this.toUserResp(saved);
  }

  async getUserByEmail(email: string) {
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('User not found');
    }
    return this.toUserResp(user);
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return this.toUserResp(user);
  }

  async validateUserRole(id: string, role: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      return { ok: false, message: 'User not found' };
    }
    if (user.role !== role) {
      return { ok: false, message: `User role is ${user.role}, not ${role}` };
    }
    return { ok: true, message: 'Role validated' };
  }

  // ---- Admin methods ----

  async getAllUsers(data: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    suspended?: string;
  }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (data.search) {
      filter.$or = [
        { name: { $regex: data.search, $options: 'i' } },
        { email: { $regex: data.search, $options: 'i' } },
      ];
    }
    if (data.role) {
      filter.role = data.role;
    }
    if (data.suspended === 'true') {
      filter.active = false;
    } else if (data.suspended === 'false') {
      filter.active = true;
    }

    const [users, total] = await Promise.all([
      this.userModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users: users.map((u) => this.toUserResp(u)),
      total,
      page,
      limit,
    };
  }

  async suspendUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    user.active = !user.active;
    const saved = await user.save();
    return this.toUserResp(saved);
  }

  async updateUserRole(id: string, role: string) {
    const validRoles = ['guest', 'host', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: { role } },
      { new: true },
    );
    if (!user) {
      throw new Error('User not found');
    }
    return this.toUserResp(user);
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { new: true },
    );
    if (!user) {
      return { ok: false, message: 'User not found' };
    }
    return { ok: true, message: 'User suspended (soft-deleted) successfully' };
  }

  async getUserCount() {
    const [total, byRole] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $project: { role: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
    ]);
    return { total, byRole };
  }

  private toUserResp(user: UserDocument) {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
    };
  }
}
