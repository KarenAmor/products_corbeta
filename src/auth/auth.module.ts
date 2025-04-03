import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { HeadersToDtoPipe } from '../pipes/headers-to-dto.pipe';
import { User } from './entities/user.entity';
import { ProductModule } from '../product/product.module'

@Module({
  imports: [TypeOrmModule.forFeature([User]), 
  forwardRef(() => ProductModule)],
  providers: [AuthService, HeadersToDtoPipe, AuthGuard],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}