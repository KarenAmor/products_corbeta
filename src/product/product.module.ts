import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductLog } from './entities/productLog.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductLogsService } from './productLogs.service'
import { ErrorNotificationService } from './error-notification.service';
@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductLog])],
  controllers: [ProductController],
  providers: [ProductService, ProductLogsService, ErrorNotificationService]
})
export class ProductModule {}
