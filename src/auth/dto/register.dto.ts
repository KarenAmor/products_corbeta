import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  usuario: string;

  @ApiProperty({ example: 'strongPassword123', description: 'User password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'admin', description: 'User role', required: false, default: 'user' })
  @IsString()
  @IsOptional()
  role?: string; // Opcional, con valor por defecto en el servicio
}