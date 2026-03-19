import {
  Controller,
  Post,
  Body,
  OnModuleInit,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RegisterDto, LoginDto, AuthResponseDto } from '../../common/dto';

interface AuthServiceGrpc {
  register(data: any): Observable<any>;
  login(data: any): Observable<any>;
  validateToken(data: any): Observable<any>;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController implements OnModuleInit {
  private authService: AuthServiceGrpc;

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authService =
      this.authClient.getService<AuthServiceGrpc>('AuthService');
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Registration failed (e.g. email taken)' })
  async register(@Body() body: RegisterDto) {
    try {
      const result = await firstValueFrom(
        this.authService.register({
          email: body.email,
          password: body.password,
          name: body.name,
          role: body.role || 'guest',
        }),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT tokens', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    try {
      const result = await firstValueFrom(
        this.authService.login({
          email: body.email,
          password: body.password,
        }),
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Login failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
