import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [TypeOrmModule.forFeature([Product]),
  AuthModule
],
  controllers: [ProductController],
  providers: [ProductService, ErrorNotificationService]
})
export class ProductModule {}
