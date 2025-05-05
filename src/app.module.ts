import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductModule } from './product/product.module';
 import {CatalogModule} from './catalog/catalog.module';
 import {PriceModule} from './price/price.module';
 import {ProductStocktModule} from './product_stock/product-stocks.module';
 import {ProdUomsModule}  from './prod_uoms/prod-uoms.module';
 
@Module({
  imports: [
    // ConfigModule para manejar variables de entorno
    ConfigModule.forRoot({
      isGlobal: true, // Hace que ConfigModule esté disponible globalmente
      envFilePath: '.env', // Especifica el archivo .env
    }),
 
    TypeOrmModule.forRootAsync({
      name: 'corbemovilTempConnection',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
 
    TypeOrmModule.forRootAsync({
      name: 'corbemovilConnection',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME_CORBEMOVIL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
 
    ProductModule, CatalogModule, PriceModule, ProductStocktModule, ProdUomsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
 