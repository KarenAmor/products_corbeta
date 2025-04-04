import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async register(usuario: string, password: string, role?: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      usuario,
      password: hashedPassword,
      role: role || 'user',
    });
    return this.userRepository.save(user);
  }

  async validateUser(usuario: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { usuario } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    // Actualizar conteo de logins y última fecha de login
    user.loginCount += 1;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return user;
  }
}