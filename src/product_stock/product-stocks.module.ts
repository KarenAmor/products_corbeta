import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStock  } from './entities/product-stock.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { Product } from '../product/entities/product.entity';
import { ProductStocksController } from './product-stocks.controller';
import { ProductStocksService } from './product-stocks.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductStock, Catalog, City, Product ], 'corbemovilTempConnection'),
  TypeOrmModule.forFeature([Product, Catalog, City], 'corbemovilConnection'),
  LogsModule
],
  controllers: [ProductStocksController],
  providers: [ProductStocksService, ErrorNotificationService]
})
export class ProductStocktModule {}