import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { HeadersToDtoPipe } from '../pipes/headers-to-dto.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly headersToDtoPipe: HeadersToDtoPipe // Inyectamos el pipe
  ) { }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
      registerDto.user,
      registerDto.password,
      registerDto.role,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Successful login' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: LoginDto })
  async login(@Headers() headers: Record<string, string>) {
    const loginDto = await this.headersToDtoPipe.transform(headers);

    if (!loginDto.user || !loginDto.password) {
      throw new UnauthorizedException('Credentials required in headers');
    }

    return this.authService.validateUser(loginDto.user, loginDto.password);
  }
}