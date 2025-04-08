import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private readonly logsService: LogsService,
  ) {}

  async createBulk(
    productsData: Partial<Product>[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {
    if (!productsData || productsData.length === 0) {
      throw new Error('No products provided for bulk creation');
    }

    const result = {
      count: 0,
      products: [] as Product[],
      errors: [] as any[],
    };

    const referenceSet = new Set<string>();

    await this.productRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < productsData.length; i += batchSize) {
        const batch = productsData.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, productData] of batch.entries()) {
          try {
            // Validación campo por campo
            const missingFields: string[] = [];
            if (productData.reference === undefined || productData.reference === null) missingFields.push('reference');
            if (productData.name === undefined || productData.name === null) missingFields.push('name');
            if (productData.packing === undefined || productData.packing === null) missingFields.push('packing');
            if (productData.convertion_rate === undefined || productData.convertion_rate === null) missingFields.push('convertion_rate');
            if (productData.vat_group === undefined || productData.vat_group === null) missingFields.push('vat_group');
            if (productData.vat === undefined || productData.vat === null) missingFields.push('vat');
            if (productData.packing_to === undefined || productData.packing_to === null) missingFields.push('packing_to');
            if (productData.is_active === undefined || productData.is_active === null) missingFields.push('is_active');

            if (missingFields.length > 0) {
              throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            // Validación de tipos
            if (typeof productData.convertion_rate !== 'number') {
              throw new Error(`Invalid type for convertion_rate: expected number, got ${typeof productData.convertion_rate}`);
            }
            if (typeof productData.vat !== 'number') {
              throw new Error(`Invalid type for vat: expected number, got ${typeof productData.vat}`);
            }
            if (typeof productData.is_active !== 'number') {
              throw new Error(`Invalid type for is_active: expected number, got ${typeof productData.is_active}`);
            }

            const reference = productData.reference as string;
            if (referenceSet.has(reference)) {
              throw new Error(`Duplicate reference '${reference}' in the batch`);
            }
            referenceSet.add(reference);

            const existingProduct = await this.productRepository.findOne({
              where: { reference },
            });

            if (existingProduct) {
              Object.assign(existingProduct, productData);
              const updatedProduct = await transactionalEntityManager.save(existingProduct);
              result.products.push(updatedProduct);

              this.logsService.log({
                sync_type: 'API',
                record_id: updatedProduct.reference.toString(),
                table_name: 'product',
                data: updatedProduct,
                event_date: new Date(),
                result: 'exitoso',
              });
            } else {
              const newProduct = this.productRepository.create(productData as Product);
              const createdProduct = await transactionalEntityManager.save(newProduct);
              result.products.push(createdProduct);

              this.logsService.log({
                sync_type: 'API',
                record_id: createdProduct.reference.toString(),
                table_name: 'product',
                data: createdProduct,
                event_date: new Date(),
                result: 'exitoso',
              });
            }

            result.count += 1;
          } catch (error) {
            batchErrors.push({
              product: productData,
              error: error.message,
              index: i + index,
            });

            this.logsService.log({
              sync_type: 'API',
              record_id: (productData.reference as string | undefined) ?? 'N/A',
              table_name: 'product',
              data: productData,
              event_date: new Date(),
              result: 'fallido',
              error_message: error.message,
            });
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
      status = 'exitoso';
      message = 'Transacción Exitosa';
    } else if (failedProducts === totalProducts) {
      status = 'fallido';
      message = `${successfulProducts} de ${totalProducts} productos insertados correctamente`;
    } else {
      status = 'partial_success';
      message = `${successfulProducts} de ${totalProducts} productos insertados correctamente`;
    }

    return {
      response: {
        code: 200, // Mantenemos 200 ya que la transacción se procesó, incluso con errores
        message,
        status,
      },
      errors: result.errors,
    };
  }
}