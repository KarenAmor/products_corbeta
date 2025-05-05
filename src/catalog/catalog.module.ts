import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from './entities/catalog.entity';
import { City } from './entities/city.entity'
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Catalog, City], 'corbemovilTempConnection'),
  TypeOrmModule.forFeature([Catalog, City], 'corbemovilConnection'),
  LogsModule,
],
  controllers: [CatalogController],
  providers: [CatalogService, ErrorNotificationService]
})
export class CatalogModule {}