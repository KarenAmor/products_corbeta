import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers;
  
    
    const usuario = headers['usuario'];  
    const password = headers['password'];
  
    if (!usuario || !password) {
      throw new UnauthorizedException('Missing authentication headers');
    }
  
    // Validar credenciales
    const isValidUser = await this.authService.validateUser(usuario, password);
    if (!isValidUser) {
      throw new UnauthorizedException('Invalid credentials');
    }
  
    return true;
  }
}  