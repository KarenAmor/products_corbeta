import { Injectable, BadRequestException } from '@nestjs/common';
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

  /**
   * Método para procesar un listado de operaciones de precios en lote (bulk).
   * Puede crear, actualizar o eliminar registros en la tabla product_prices.
   */
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

    // Se obtiene el flag de configuración para permitir borrado de registros
    const DELETE_RECORD = this.configService.get<boolean>('DELETE_RECORD', true);

    // Resultado acumulativo de la operación
    const result = {
      count: 0,
      prices: [] as ProductPrice[],
      errors: [] as any[],
    };

    // Ejecutar todo dentro de una transacción
    await this.productPriceRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        // Procesar cada operación del batch
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

            // Buscar la ciudad relacionada con el business_unit
            const city = await transactionalEntityManager.findOne(City, {
              where: { name: operation.business_unit },
            });

            if (!city) {
              throw new Error(`City not found for business_unit ${operation.business_unit}`);
            }
            // Buscar el catálogo dentro de la ciudad
            const catalog = await transactionalEntityManager.findOne(Catalog, {
              where: { name: operation.catalog, city_id: city.id },
            });

            if (!catalog) {
              throw new Error(`Catalog not found for business_unit ${operation.business_unit} and catalog ${operation.catalog}`);
            }

            const catalog_id = catalog.id;

            // Buscar si ya existe un precio para el producto en ese catálogo
            const existingPrice = await transactionalEntityManager.findOne(ProductPrice, {
              where: { catalog_id, product_reference: operation.product_id },
            });

            // Armar el objeto de precio
            const productPriceData: Partial<ProductPrice> = {
              catalog_id,
              product_reference: operation.product_id,
              price: operation.price,
              vlr_impu_consumo: operation.vlr_impu_consumo,
              is_active: operation.is_active,
            };

            let savedPrice: ProductPrice | null;

            if (!existingPrice) {
              // Si no existe, se crea nuevo
              const newPrice = this.productPriceRepository.create(productPriceData);
              savedPrice = await transactionalEntityManager.save(newPrice);
            } else {
              if (operation.is_active === 0 && DELETE_RECORD) {
                // Si existe pero is_active = 0 y DELETE_RECORD es true, eliminarlo
                await transactionalEntityManager.remove(existingPrice);
                savedPrice = null;
              } else {
                // Si existe y sigue activo, actualizar el precio
                Object.assign(existingPrice, productPriceData);
                savedPrice = await transactionalEntityManager.save(existingPrice);
              }
            }

            // Loguear el resultado (creado, modificado o eliminado)
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
              // Caso eliminación
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
            // Capturar errores individuales por operación
            const errorMessage = error.message || 'Unknown error';
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

        // Agregar errores del batch al resultado general
        result.errors.push(...batchErrors);
      }
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

    // Devolver el resultado final
    return {
      response: {
        code: 200,
        message,
        status,
      },
      errors: result.errors,
    };
  }

  /**
   * Método auxiliar para obtener todos los precios de productos.
   */
  async findAll(): Promise<ProductPrice[]> {
    return this.productPriceRepository.find();
  }
}