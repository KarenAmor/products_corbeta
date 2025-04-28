import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductModule } from './product/product.module';
import { CatalogModule } from './catalog/catalog.module';
import { PriceModule } from './price/price.module';
import {ProducStocktModule} from './product_stock/product-stocks.module'


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
    
    ProductModule, CatalogModule, PriceModule, ProducStocktModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}