import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStock } from './entities/product-stock.entity';
import { ProductStockController} from './product-stocks.controller';
import { ProductStockService } from './product-stocks.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductStock]), 
  AuthModule, LogsModule ],
  controllers: [ProductStockController],
  providers: [ProductStockService, ErrorNotificationService],
  exports: [ProductStockService],
})
export class ProductStocksModule {}
