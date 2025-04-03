import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HeadersToDtoPipe } from '../pipes/headers-to-dto.pipe';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AuthService, HeadersToDtoPipe],
  controllers: [AuthController],
})
export class AuthModule {}