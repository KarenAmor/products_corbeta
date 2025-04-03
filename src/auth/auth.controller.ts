import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { HeadersToDtoPipe } from '../pipes/headers-to-dto.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly headersToDtoPipe: HeadersToDtoPipe // Inyectamos el pipe
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.role,
    );
  }

  @Post('login')
  async login(@Headers() headers: Record<string, string>) { // Recibimos headers crudos
    // Aplicamos el pipe manualmente
    const loginDto = await this.headersToDtoPipe.transform(headers);
    
    // Validación adicional (opcional)
    if (!loginDto.email || !loginDto.password) {
      throw new UnauthorizedException('Credentials required in headers');
    }
    
    return this.authService.validateUser(loginDto.email, loginDto.password);
  }
}