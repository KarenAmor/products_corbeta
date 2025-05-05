import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPrice } from './entities/product-price.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { Product } from '../product/entities/product.entity';
import { ProductPricesController} from './price.controller';
import { ProductPricesService } from './price.service';
import { LogsModule } from '../logs/logs.module';
import { ErrorNotificationService} from '../utils/error-notification.service'
@Module({
  imports: [TypeOrmModule.forFeature([ProductPrice, Product, Catalog], 'corbemovilTempConnection'),
  // Entidades para la conexión corbeMovilConnection (movilven_corbeta_sales)
  TypeOrmModule.forFeature([Product, Catalog, City], 'corbemovilConnection'),
  LogsModule,
],
  controllers: [ProductPricesController],
  providers: [ProductPricesService, ErrorNotificationService]
})
export class PriceModule {}