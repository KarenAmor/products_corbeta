import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product, 'corbemovilTempConnection')
    private productRepository: Repository<Product>,
    private readonly logsService: LogsService,
  ) { }

  async createBulk(
    productsData: Partial<Product>[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {
    if (!productsData || productsData.length === 0) {
      throw new BadRequestException({
        response: {
          code: 400,
          message: 'No products provided in the products array',
          status: 'failed',
        },
        errors: [],
      });
    }

    const result = {
      count: 0,
      products: [] as Product[],
      errors: [] as any[],
    };

    // Set para validar duplicados dentro del mismo lote
    const referenceSet = new Set<string>();

    await this.productRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < productsData.length; i += batchSize) {
        const batch = productsData.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, productData] of batch.entries()) {
          try {
            // Validación de campos requeridos y longitud
            const missingFields: string[] = [];
            const invalidFields: string[] = [];

            // Validar que ningún campo sea undefined, null ni vacío
            if (!productData.reference?.trim()) missingFields.push('reference');
            if (!productData.name?.trim()) missingFields.push('name');
            if (!productData.packing?.trim()) missingFields.push('packing');
            if (productData.convertion_rate === undefined || productData.convertion_rate === null)
              missingFields.push('convertion_rate');
            if (!productData.vat_group?.trim()) missingFields.push('vat_group');
            if (productData.vat === undefined || productData.vat === null) missingFields.push('vat');
            if (!productData.packing_to?.trim()) missingFields.push('packing_to');
            // Validación de is_active
            if (productData.is_active === undefined || productData.is_active === null) {
              missingFields.push('is_active');
            } else if (typeof productData.is_active !== 'number' || ![0, 1].includes(productData.is_active)) {
              invalidFields.push(`is_active debe ser un número (0 o 1), se recibió ${productData.is_active}`);
            }



            if (missingFields.length > 0) {
              throw new Error(`Missing, empty or null fields: ${missingFields.join(', ')}`);
            }

            // Validación de longitud
            if (productData.packing && productData.packing.length > 3) {
              invalidFields.push(`packing: expected max 3 characters, got ${productData.packing.length}`);
            }
            if (productData.packing_to && productData.packing_to.length > 3) {
              invalidFields.push(`packing_to: expected max 3 characters, got ${productData.packing_to.length}`);
            }
            if (productData.vat_group && productData.vat_group.length > 10) {
              invalidFields.push(`vat_group: expected max 10 characters, got ${productData.vat_group.length}`);
            }

            // Validación de decimales
            if (productData.convertion_rate !== undefined && productData.convertion_rate !== null) {
              const decimalPlaces = productData.convertion_rate.toString().split('.')[1]?.length || 0;
              if (decimalPlaces > 8) {
                invalidFields.push(`convertion_rate: expected max 8 decimal places, got ${decimalPlaces}`);
              }
            }
            if (productData.vat !== undefined && productData.vat !== null) {
              const decimalPlaces = productData.vat.toString().split('.')[1]?.length || 0;
              if (decimalPlaces > 2) {
                invalidFields.push(`vat: expected max 2 decimal places, got ${decimalPlaces}`);
              }
            }

            // Validación de tipos
            if (
              productData.convertion_rate !== undefined &&
              productData.convertion_rate !== null &&
              typeof productData.convertion_rate !== 'number'
            ) {
              invalidFields.push(`convertion_rate: expected number, got ${typeof productData.convertion_rate}`);
            }
            if (typeof productData.vat !== 'number') {
              invalidFields.push(`vat: expected number, got ${typeof productData.vat}`);
            }

            if (invalidFields.length > 0) {
              throw new Error(`Invalid fields: ${invalidFields.join('; ')}`);
            }

            // Validación de referencia duplicada
            const reference = productData.reference!.trim();
            if (referenceSet.has(reference)) {
              throw new Error(`Duplicate reference '${reference}' in the batch`);
            }
            referenceSet.add(reference);

            // Validación de referencia existente en la base de datos
            const existingProduct = await transactionalEntityManager.findOne(Product, { where: { reference } });
            let savedProduct: Product;
            let message = '';

            if (existingProduct) {
              Object.assign(existingProduct, productData);
              savedProduct = await transactionalEntityManager.save(existingProduct);
              message = 'Row Updated';
            } else {
              const newProduct = this.productRepository.create(productData as Product);
              savedProduct = await transactionalEntityManager.save(newProduct);
              message = 'Row Created';
            }

            if (savedProduct) {
              result.products.push(savedProduct);
              result.count += 1;
            }


            try {
              this.logsService.log({
                sync_type: 'API',
                record_id: reference,
                process: 'product',
                row_data: productData,
                event_date: new Date(),
                result: message,
              });
            } catch (logError) {
              console.warn(`Failed to log success for product ${reference}: ${logError.message}`);
            }


          } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            batchErrors.push({
              product: productData,
              error: errorMessage,
              index: i + index,
            });

            try {
              this.logsService.log({
                sync_type: 'API',
                record_id: productData.reference?.trim() || `INVALID_REF_${i + index}`,
                process: 'product',
                row_data: productData,
                event_date: new Date(),
                result: 'failed',
                error_message: errorMessage,
              });
            } catch (logError) {
              console.warn(`Failed to log error for product at index ${i + index}: ${logError.message}`);
            }
          }
        }
        result.errors.push(...batchErrors);
      }
    });

    const totalProducts = productsData.length;
    const successfulProducts = result.count;
    const failedProducts = result.errors.length;

    let status: string;
    let message: string;

    if (successfulProducts === totalProducts) {
      status = 'successful';
      message = 'Transaction Successful';
    } else if (failedProducts === totalProducts) {
      status = 'failed';
      message = 'All products contain invalid data';
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
      message = `${successfulProducts} of ${totalProducts} products inserted successfully`;
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