// src/product-stocks/product-stocks.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ProductStock } from './entities/product-stock.entity';
import { City } from '../catalog/entities/city.entity';
import { ProductStockOperationDto } from './dto/create-product-stock.dto';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductStocksService {
  constructor(
    @InjectRepository(ProductStock)
    private readonly productStockRepository: Repository<ProductStock>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
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

    const DELETE_RECORD = this.configService.get<boolean>('DELETE_RECORD', true);

    const result = {
      count: 0,
      stocks: [] as ProductStock[],
      errors: [] as any[],
    };

    await this.productStockRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, operation] of batch.entries()) {
          try {
            const requiredFields = ['business_unit', 'product_id', 'stock'];
            const missingFields = requiredFields.filter(field => {
              const value = operation[field];
              return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
            });

            if (operation.is_active === undefined || operation.is_active === null) {
              missingFields.push('is_active');
            }

            if (missingFields.length > 0) {
              throw new Error(`Missing required field(s): ${missingFields.join(', ')}`);
            }

            const city = await transactionalEntityManager.findOne(City, {
              where: { name: operation.business_unit },
            });

            if (!city) {
              throw new Error(`City not found for business_unit ${operation.business_unit}`);
            }

            const city_id = city.id;

            const existingStock = await transactionalEntityManager.findOne(ProductStock, {
              where: { product_id: operation.product_id, city_id },
            });

            const now = new Date();

            const productStockData: Partial<ProductStock> = {
              product_id: operation.product_id,
              city_id,
              stock: operation.stock,
              is_active: operation.is_active,
              created: now,
              modified: now,
            };

            let savedStock: ProductStock | null;

            if (!existingStock) {
              const newStock = this.productStockRepository.create(productStockData);
              savedStock = await transactionalEntityManager.save(newStock);
            } else {
              if (operation.is_active === 0 && DELETE_RECORD) {
                await transactionalEntityManager.remove(existingStock);
                savedStock = null;
              } else {
                Object.assign(existingStock, productStockData);
                savedStock = await transactionalEntityManager.save(existingStock);
              }
            }

            const { created, modified, ...logRowData } = savedStock || {};

            if (savedStock) {
              await this.logsService.log({
                sync_type: 'API',
                record_id: savedStock.product_id,
                process: 'product_stock',
                row_data: logRowData,
                event_date: new Date(),
                result: 'successful',
              });
              result.stocks.push(savedStock);
              result.count += 1;
            } else {
              await this.logsService.log({
                sync_type: 'API',
                record_id: operation.product_id,
                process: 'product_stock',
                row_data: {
                  city_id,
                  product_id: operation.product_id,
                },
                event_date: new Date(),
                result: 'deleted',
              });
              result.count += 1;
            }

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