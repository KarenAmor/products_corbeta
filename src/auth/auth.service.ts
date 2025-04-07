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

  async register(user: string, password: string, role?: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = this.userRepository.create({
      user, 
      password: hashedPassword,
      role: role || 'user',
    });
    return this.userRepository.save(newUser);
  }

  async validateUser(user: string, password: string): Promise<User> {
    const foundUser = await this.userRepository.findOne({ where: { user } });
    if (!foundUser) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, foundUser.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    foundUser.loginCount += 1;
    foundUser.lastLoginAt = new Date();
    await this.userRepository.save(foundUser);

    return foundUser;
  }
}