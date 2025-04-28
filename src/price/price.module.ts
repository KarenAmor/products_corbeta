import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPrice } from './entities/product-price.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { ProductPricesController} from './price.controller';
import { ProductPricesService } from './price.service';
import { LogsModule } from '../logs/logs.module';
import { ErrorNotificationService} from '../utils/error-notification.service'
@Module({
  imports: [TypeOrmModule.forFeature([ProductPrice, Catalog, City]),
  LogsModule,
],
  controllers: [ProductPricesController],
  providers: [ProductPricesService, ErrorNotificationService]
})
export class PriceModule {}