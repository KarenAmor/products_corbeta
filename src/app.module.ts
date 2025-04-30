import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductModule } from './product/product.module';
import { CatalogModule } from './catalog/catalog.module';
import { PriceModule } from './price/price.module';
import {ProducStocktModule} from './product_stock/product-stocks.module'
import { ProdUomsModule} from './prod_uoms/prod-uoms.module';
import { Product } from './product/entities/product.entity'; 
import { Catalog } from './catalog/entities/catalog.entity';
import { City } from './catalog/entities/city.entity';


@Module({
  imports: [
    // ConfigModule para manejar variables de entorno
    ConfigModule.forRoot({
      isGlobal: true, // Hace que ConfigModule esté disponible globalmente
      envFilePath: '.env', // Especifica el archivo .env
    }),
    
    // Configuración de TypeORM usando ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'test'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      name: 'corbeMovilConnection', // Nombre único para la segunda conexión
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME_CORBEMOVIL', 'movilven_corbeta_sales'),
        entities: [Product, Catalog, City], // Entidades específicas para esta DB
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    
    ProductModule, CatalogModule, PriceModule, ProducStocktModule, ProdUomsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}