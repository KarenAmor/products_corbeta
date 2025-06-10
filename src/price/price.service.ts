import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ProductPrice } from './entities/product-price.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { Product } from '../product/entities/product.entity'
import { ProductPriceOperationDto } from './dto/create-product-price.dto';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductPricesService {
  constructor(
    @InjectRepository(ProductPrice, 'corbemovilTempConnection')
    private readonly productPriceTempRepository: Repository<ProductPrice>,
    @InjectRepository(City, 'corbemovilConnection')
    private readonly cityRepository: Repository<City>,
    @InjectRepository(Product, 'corbemovilConnection')
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Product, 'corbemovilTempConnection')
    private readonly productTempRepository: Repository<Product>,
    @InjectRepository(Catalog, 'corbemovilConnection')
    private readonly catalogCorbeMovilRepository: Repository<Catalog>,
    @InjectRepository(Catalog, 'corbemovilTempConnection')
    private readonly catalogTempRepository: Repository<Catalog>,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {
    console.log('ProductPricesService initialized');
  }

  async createBulk(
    operations: ProductPriceOperationDto[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {

    // Validar si vienen operaciones
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

    // Obtener flags de configuración
    const DELETE_RECORD = this.configService.get<string>('DELETE_RECORD');
    const VALIDATE_BD_TEMP = this.configService.get<string>('VALIDATE_BD_TEMP');

    // Resultado acumulativo de la operación
    const result = {
      count: 0,
      prices: [] as ProductPrice[],
      errors: [] as any[],
    };

    // Ejecutar todo dentro de una transacción
    await this.productPriceTempRepository.manager.transaction(async (transactionalEntityManager) => {
      
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        // Procesar cada operación del batch
        for (const [index, operation] of batch.entries()) {
          try {
            // Validación de campos obligatorios
            const requiredFields = ['business_unit', 'catalog', 'product_id', 'price', 'vlr_impu_consumo', 'is_active'];
            const missingFields = requiredFields.filter((field) => {
              const value = operation[field];
              return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
            });

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

            // Buscar la unidad de negocio en tabla city
            const city = await this.cityRepository.findOne({
              select: ['id','name'],
              where: { name: operation.business_unit },
            });

            if (!city) {
              throw new Error(`Business unit not found for business_unit ${operation.business_unit}`);
            }

            // Validar existencia del catálogo
            let catalogId: number | null = null;

            const catalogCorbeMovil = await this.catalogCorbeMovilRepository.findOne({
              select: ['id', 'name', 'city_id'],
              where: { name: operation.catalog, city_id: city.id },
            });

            if (catalogCorbeMovil) {
              catalogId = catalogCorbeMovil.id;
            } else if (VALIDATE_BD_TEMP === 'true') {
              const catalogTemp = await this.catalogTempRepository.findOne({
                select: ['id', 'name', 'city_id'],
                where: { name: operation.catalog, city_id: city.id },
              });
              if (catalogTemp) {
                catalogId = catalogTemp.id;
              }
            }

            if (!catalogId) {
              throw new Error(
                `Catalog ${operation.catalog} not found for business_unit ${operation.business_unit} in the required databases`,
              );
            }

            // Buscar si ya existe un precio
            const existingPrice = await this.productPriceTempRepository.findOne({
              where: { catalog_id: catalogId, product_reference: operation.product_id },
            });

            let savedPrice: ProductPrice | null;
            let message = "";

            // Armar el objeto de precio
            const productPriceData: Partial<ProductPrice> = {
              catalog_id: catalogId,
              product_reference: operation.product_id,
              price: operation.price,
              vlr_impu_consumo: operation.vlr_impu_consumo,
              is_active: operation.is_active,
              created: operation.created ?? new Date(),
            };

            if (existingPrice) {
              if (operation.is_active === 0 && DELETE_RECORD === 'true') {
                savedPrice = await this.productPriceTempRepository.remove(existingPrice);
                message = "Row Deleted";
              } else {
                Object.assign(existingPrice, productPriceData);
                savedPrice = await this.productPriceTempRepository.save(productPriceData);
                message = "Row Updated";
              }
            } else {
              const newRow = this.productPriceTempRepository.create(productPriceData);
              savedPrice = await this.productPriceTempRepository.save(newRow);
              message = "Row Created";
            }

            if (savedPrice) {
              result.prices.push(savedPrice);
              result.count += 1;
            }
            await this.logsService.log({
              sync_type: 'API',
              record_id: operation.product_id,
              process: 'product_price',
              row_data: operation,
              event_date: new Date(),
              result: message,
            });

          } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`Error in operation ${i + index + 1}:`, errorMessage);
            batchErrors.push({
              operation,
              error: errorMessage,
              index: i + index,
            });

            // Loguear el error
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
      console.log('Transaction completed');
    });

    // Determinar el estatus de la operación
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
      console.log('All operations failed');
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