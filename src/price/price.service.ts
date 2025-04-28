import { Injectable,  BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ProductPrice } from './entities/product-price.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { ProductPriceOperationDto } from './dto/create-product-price.dto';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductPricesService {
  constructor(
    @InjectRepository(ProductPrice)
    private readonly productPriceRepository: Repository<ProductPrice>,
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) { }

  async createBulk(
    operations: ProductPriceOperationDto[],
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
      prices: [] as ProductPrice[],
      errors: [] as any[],
    };

    await this.productPriceRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, operation] of batch.entries()) {
          try {
            // Validación de campos obligatorios
            // Validación de campos obligatorios de forma detallada
            const requiredFields = ['business_unit', 'catalog', 'product_id', 'price', 'vlr_impu_consumo', 'is_active'];
            const missingFields = requiredFields.filter(field => {
              const value = operation[field];
              return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
            });

            if (missingFields.length > 0) {
              // Si falta uno o más campos, generar un error detallado
              throw new Error(`Missing required field(s): ${missingFields.join(', ')}`);
            }


            const city = await transactionalEntityManager.findOne(City, {
              where: { name: operation.business_unit },
            });

            if (!city) {
              throw new Error(`City not found for business_unit ${operation.business_unit}`);
            }

            const catalog = await transactionalEntityManager.findOne(Catalog, {
              where: { name: operation.catalog, city_id: city.id },
            });

            if (!catalog) {
              throw new Error(`Catalog not found for business_unit ${operation.business_unit} and catalog ${operation.catalog}`);
            }

            const catalog_id = catalog.id;

            const existingPrice = await transactionalEntityManager.findOne(ProductPrice, {
              where: { catalog_id, product_reference: operation.product_id },
            });

            const productPriceData: Partial<ProductPrice> = {
              catalog_id,
              product_reference: operation.product_id,
              price: operation.price,
              vlr_impu_consumo: operation.vlr_impu_consumo,
              is_active: operation.is_active,
            };

            let savedPrice: ProductPrice | null;

            if (!existingPrice) {
              const newPrice = this.productPriceRepository.create(productPriceData);
              savedPrice = await transactionalEntityManager.save(newPrice);
            } else {
              if (operation.is_active === 0 && DELETE_RECORD) {
                await transactionalEntityManager.remove(existingPrice);
                savedPrice = null;
              } else {
                Object.assign(existingPrice, productPriceData);
                savedPrice = await transactionalEntityManager.save(existingPrice);
              }
            }

            // Loguear el resultado
            const { created, modified, ...logRowData } = savedPrice || {};

            if (savedPrice) {
              await this.logsService.log({
                sync_type: 'API',
                record_id: savedPrice.product_reference,
                process: 'product_price',
                row_data: logRowData,
                event_date: new Date(),
                result: 'successful',
              });
              result.prices.push(savedPrice);
              result.count += 1;
            } else {
              await this.logsService.log({
                sync_type: 'API',
                record_id: operation.product_id,
                process: 'product_price',
                row_data: {
                  catalog_id,
                  product_reference: operation.product_id,
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
                process: 'product_price',
                row_data: operation,
                event_date: new Date(),
                result: 'failed',
                error_message: errorMessage,
              });
            } catch (logError) {
              console.warn(`Failed to log error for product_price at index ${i + index}: ${logError.message}`);
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

  async findAll(): Promise<ProductPrice[]> {
    return this.productPriceRepository.find();
  }
}