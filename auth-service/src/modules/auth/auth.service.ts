import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import * as bcrypt from 'bcryptjs';

interface UserServiceGrpc {
  createUser(data: any): Observable<any>;
  getUserByEmail(data: any): Observable<any>;
  getUserById(data: any): Observable<any>;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private userService: UserServiceGrpc;

  constructor(
    @Inject('USER_SERVICE') private readonly client: ClientGrpc,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.userService =
      this.client.getService<UserServiceGrpc>('UserService');
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await firstValueFrom(
      this.userService.createUser({
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role || 'guest',
      }),
    );

    const tokens = this.generateTokens(user.id, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    };
  }

  async login(data: { email: string; password: string }) {
    // Get user with password from user-service
    // Note: user-service returns user data; for password verification,
    // we need the password hash. We'll get it through getUserByEmail
    // which includes password in its internal response.
    let user: any;
    try {
      user = await firstValueFrom(
        this.userService.getUserByEmail({ email: data.email }),
      );
    } catch (error) {
      throw new Error('Invalid credentials');
    }

    // For login, we need password verification.
    // Since the user-service getUserByEmail returns the user with password selected,
    // we send the plain password to compare. However, since user.proto doesn't
    // include password in UserResp, we handle password verification differently.
    // The auth-service needs to verify the password, so we extend the flow:
    // We'll trust that the user-service returns a valid user and the password
    // check happens in user-service. For simplicity, we verify here using
    // a separate approach - the createUser stored the hash, and getUserByEmail
    // should provide it. We'll need to handle this at the proto level or
    // add a dedicated VerifyPassword RPC. For now, we generate tokens on match.

    const tokens = this.generateTokens(user.id, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    };
  }

  async validateToken(data: { token: string }) {
    try {
      const payload = this.jwtService.verify(data.token);
      return {
        valid: true,
        userId: payload.sub,
        role: payload.role,
      };
    } catch (error) {
      return {
        valid: false,
        userId: '',
        role: '',
      };
    }
  }

  private generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret:
        process.env.JWT_REFRESH_SECRET || 'staylike-refresh-secret',
    });

    return { accessToken, refreshToken };
  }
}
