import { Injectable, PipeTransform, UnauthorizedException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../auth/dto/login.dto';

@Injectable()
export class HeadersToDtoPipe implements PipeTransform {
  async transform(headers: any): Promise<LoginDto>  {
    const loginDto = plainToClass(LoginDto, {
      user: headers.user,
      password: headers.password,
    });
    
    const errors = await validate(loginDto);
    if (errors.length > 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    return loginDto;
  }
}