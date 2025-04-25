import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductPrice } from './entities/product-price.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { ProductPricesController} from './price.controller';
import { ProductPricesService } from './price.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductPrice, Catalog, City]),
],
  controllers: [ProductPricesController],
  providers: [ProductPricesService]
})
export class PriceModule {}