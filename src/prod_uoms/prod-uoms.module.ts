import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProdUom } from './entities/prod-uom.entity';
import { Product } from '../product/entities/product.entity';
import { ProdUomsController } from './prod-uoms.controller';
import { ProdUomsService } from './prod-uoms.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProdUom, Product], 'corbemovilTempConnection'),

  TypeOrmModule.forFeature([Product], 'corbemovilConnection'),
    LogsModule
  ],
  controllers: [ProdUomsController],
  providers: [ProdUomsService, ErrorNotificationService]
})
export class ProdUomsModule { }