import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; role?: string }) {
    return this.authService.register(body.email, body.password, body.role);
  }

  @Post('login')
  async login(@Headers('email') email: string, @Headers('password') password: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Credentials required in headers');
    }
    return this.authService.validateUser(email, password);
  }
}