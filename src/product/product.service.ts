import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { instanceToPlain } from 'class-transformer';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {} // Se eliminó ProductLogsService

  async createBulk(
    productsData: Partial<Product>[],
    batchSize = 100,
  ): Promise<{ count: number; products: Product[]; errors: any[] }> {
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

        for (const productData of batch) {
          try {
            if (!productData.reference || !productData.name || !productData.tipoEvento) {
              throw new Error('Reference, name and tipoEvento are required');
            }

            if (referenceSet.has(productData.reference)) {
              throw new Error(`Duplicate reference '${productData.reference}' in the batch`);
            }
            referenceSet.add(productData.reference);

            const existingProduct = await this.productRepository.findOne({
              where: { reference: productData.reference },
            });
            if (existingProduct) {
              const oldData = JSON.parse(JSON.stringify(existingProduct));
              Object.assign(existingProduct, productData, { procesado: false });
              const updatedProduct = await transactionalEntityManager.save(existingProduct);
              
              // Se eliminó la llamada a createLog
              result.products.push(updatedProduct);
            } else {
              productData.procesado = false;
              const newProduct = this.productRepository.create(productData);
              const createdProduct = await transactionalEntityManager.save(newProduct);
              
              // Se eliminó la llamada a createLog
              result.products.push(createdProduct);
            }
            result.count += 1;
          } catch (error) {
            batchErrors.push({
              product: productData,
              error: error.message,
            });
          }
        }
        result.errors.push(...batchErrors);
      }
    });

    return result;
  }
}