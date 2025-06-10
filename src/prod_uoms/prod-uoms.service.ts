// src/prod-uoms/prod-uoms.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ProdUom } from './entities/prod-uom.entity';
import { CreateProdUomDto } from './dto/create-prod-uom.dto';
import { LogsService } from '../logs/logs.service';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class ProdUomsService {
  constructor(
    @InjectRepository(ProdUom, 'corbemovilTempConnection')
    private readonly prodUomTempRepository: Repository<ProdUom>,
    @InjectRepository(Product, 'corbemovilConnection') // Conexión a movilven_corbeta_sales
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Product, 'corbemovilTempConnection') // Conexión a movilven_corbeta_sales_temp
    private readonly productTempRepository: Repository<Product>,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {}

  async createBulk(
    operations: CreateProdUomDto[],
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

    const DELETE_RECORD = this.configService.get<string>('DELETE_RECORD', 'true');
    const VALIDATE_BD_TEMP = this.configService.get<string>('VALIDATE_BD_TEMP');

    const result = {
      count: 0,
      uoms: [] as ProdUom[],
      errors: [] as any[],
    };

    await this.prodUomTempRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, operation] of batch.entries()) {
          try {
            const requiredFields = ['product_id', 'unit_of_measure', 'min_order_qty', 'max_order_qty', 'order_increment'];
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
              where: { reference: operation.product_id },
            });

            if (productCorbeMovil) {
              productExists = true;
            } else if (VALIDATE_BD_TEMP === 'true') {
              const productTemp = await this.productTempRepository.findOne({
                where: { reference: operation.product_id },
              });
              if (productTemp) {
                productExists = true;
              }
            }

            if (!productExists) {
              throw new Error(`Product with ID ${operation.product_id} does not exist in the required databases`);
            }

            const existing = await manager.findOne(ProdUom, {
              where: {
                product_id: operation.product_id
              },
            });

            let saved: ProdUom | null = null;
            let message = '';

            const data: Partial<ProdUom> = {
              ...operation,
              created: new Date(),
              modified: new Date(),
            };

            if (existing) {
              if (operation.is_active === 0 && DELETE_RECORD === 'true') {
                saved = await this.prodUomTempRepository.remove(existing);
                message = 'Row Deleted';
              } else {
                Object.assign(existing, data);
                saved = await this.prodUomTempRepository.save(existing);
                message = 'Row Updated';
              }
            } else {
                const newUom = this.prodUomTempRepository.create(data);
                saved = await this.prodUomTempRepository.save(newUom);
                message = 'Row Created';
            }
            if(saved){
              result.uoms.push(saved);
              result.count += 1;
            }

              await this.logsService.log({
                sync_type: 'API',
                record_id: operation.product_id,
                process: 'prod_uoms',
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
                process: 'prod_uoms',
                row_data: operation,
                event_date: new Date(),
                result: 'failed',
                error_message: errorMessage,
              });
            } catch (logError) {
              console.warn(`Failed to log error for prod_uoms at index ${i + index}: ${logError.message}`);
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