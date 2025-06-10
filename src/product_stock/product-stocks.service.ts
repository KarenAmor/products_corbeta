// src/product-stocks/product-stocks.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ProductStock } from './entities/product-stock.entity';
import { Product } from '../product/entities/product.entity';
import { City } from '../catalog/entities/city.entity';
import { ProductStockOperationDto } from './dto/create-product-stock.dto';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductStocksService {
  constructor(
    @InjectRepository(ProductStock, 'corbemovilTempConnection')
    private readonly productStockTempRepository: Repository<ProductStock>,
    @InjectRepository(City, 'corbemovilConnection')
    private readonly cityRepository: Repository<City>,
    @InjectRepository(Product, 'corbemovilConnection') // Conexión a movilven_corbeta_sales
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Product, 'corbemovilTempConnection') // Conexión a movilven_corbeta_sales_temp
    private readonly productTempRepository: Repository<Product>,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService
  ) {}

  async createBulk(
    operations: ProductStockOperationDto[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {
    if (!operations || operations.length === 0) {
      throw new BadRequestException({
        response: {
          code: 400,
          message: 'No operations provided in the array',
          status: 'failed',
        },
        errors: [],
      });
    }

    const DELETE_RECORD = this.configService.get<string>('DELETE_RECORD');
    const VALIDATE_BD_TEMP = this.configService.get<string>('VALIDATE_BD_TEMP');

    const result = {
      count: 0,
      stocks: [] as ProductStock[],
      errors: [] as any[],
    };

    await this.productStockTempRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, operation] of batch.entries()) {
          try {
            const requiredFields = ['business_unit', 'product_id', 'stock'];
            const missingFields = requiredFields.filter((field) => {
              const value = operation[field];
              return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
            });

            if (operation.is_active === undefined || operation.is_active === null) {
              missingFields.push('is_active');
            }

            if (missingFields.length > 0) {
              throw new Error(`Missing required field(s): ${missingFields.join(', ')}`);
            }

            const isActiveValue = operation['is_active'];
            if (isActiveValue !== 0 && isActiveValue !== 1) {
              throw new Error(`Invalid value for is_active: ${isActiveValue}. Only 0 or 1 are allowed.`);
            }

            // Validar existencia del producto
            let productExists = false;
            const productCorbeMovil = await this.productRepository.findOne({
              select: ['reference'],
              where: { reference: operation.product_id },
            });

            if (productCorbeMovil) {
              productExists = true;
            } else if (VALIDATE_BD_TEMP === 'true') {
              const productTemp = await this.productTempRepository.findOne({
                select: ['reference'],
                where: { reference: operation.product_id },
              });
              if (productTemp) {
                productExists = true;
              }
            }

            if (!productExists) {
              throw new Error(`Product with ID ${operation.product_id} does not exist in the required databases`);
            }

            //Valida la existencia de la unidad de negocio
            const city = await this.cityRepository.findOne({
              select: ['id','name'],
              where: { name: operation.business_unit },
            });

            if (!city) {
              throw new Error(`Business unit not found for business_unit ${operation.business_unit}`);
            }

            const city_id = city.id;

            const existingStock = await this.productStockTempRepository.findOne({
              where: { product_id: operation.product_id, city_id },
            });

            let savedStock: ProductStock | null = null;
            let message = '';

            const productStockData: Partial<ProductStock> = {
              product_id: operation.product_id,
              city_id: city.id,
              stock: operation.stock,
              is_active: operation.is_active,
              created: new Date(),
              modified: new Date(),
            };

            if (existingStock) {
              if (operation.is_active === 0 && DELETE_RECORD === 'true') {
                savedStock = await this.productStockTempRepository.remove(existingStock);
                message = 'Row Deleted';
              } else {
                Object.assign(existingStock, productStockData);
                savedStock = await this.productStockTempRepository.save(existingStock);
                message = 'Row Updated';
              }
            } else {
              const newRow = this.productStockTempRepository.create(productStockData)
                savedStock = await this.productStockTempRepository.save(newRow);
                message = 'Row Created';
            }

            if (savedStock) {
              result.stocks.push(savedStock);
              result.count += 1;
            } 

            await this.logsService.log({
              sync_type: 'API',
              record_id: operation.product_id,
              process: 'product_stock',
              row_data: operation,
              event_date: new Date(),
              result: message,
            });

          } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            batchErrors.push({
              operation,
              error: errorMessage,
              index: i + index,
            });

            try {
              await this.logsService.log({
                sync_type: 'API',
                record_id: operation.product_id || `INVALID_REF_${i + index}`,
                process: 'product_stock',
                row_data: operation,
                event_date: new Date(),
                result: 'failed',
                error_message: errorMessage,
              });
            } catch (logError) {
              console.warn(`Failed to log error for product_stock at index ${i + index}: ${logError.message}`);
            }
          }
        }

        result.errors.push(...batchErrors);
      }
    });

    const total = operations.length;
    const success = result.count;
    const failed = result.errors.length;

    let status: string;
    let message: string;

    if (success === total) {
      status = 'successful';
      message = 'Transaction Successful';
    } else if (failed === total) {
      status = 'failed';
      message = 'All operations contain invalid data';
      throw new BadRequestException({
        response: {
          code: 400,
          message,
          status,
        },
        errors: result.errors,
      });
    } else {
      status = 'partial_success';
      message = `${success} of ${total} operations processed successfully`;
    }

    return {
      response: {
        code: 200,
        message,
        status,
      },
      errors: result.errors,
    };
  }
}