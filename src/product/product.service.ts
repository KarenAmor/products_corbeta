import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductLogsService } from './productLogs.service';

@Injectable()
export class ProductService {
    constructor(
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        private productLogsService: ProductLogsService,
    ) { }

    async findAll(page: number = 1, limit: number = 10): Promise<{ data: Product[]; total: number }> {
        const [data, total] = await this.productRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
        });
        return { data, total };
    }

    async searchByKeyword(keyword: string): Promise<Product[]> {
        return this.productRepository.find({
            where: [
                { name: Like(`%${keyword}%`) },
            ],
        });
    }

    async findOne(reference: string): Promise<Product> {
        const product = await this.productRepository.findOne({ where: { reference } });
        if (!product) {
            throw new NotFoundException(`Product with reference ${reference} not found`);
        }
        return product;
    }

    async createBulk(productsData: Partial<Product>[], batchSize = 100): Promise<{ count: number, products: Product[], errors: any[] }> {
        if (!productsData || productsData.length === 0) {
            throw new Error('No products provided for bulk creation');
        }
    
        const result = {
            count: 0,
            products: [] as Product[],
            errors: [] as any[]
        };
    
        await this.productRepository.manager.transaction(async (transactionalEntityManager) => {
            for (let i = 0; i < productsData.length; i += batchSize) {
                const batch = productsData.slice(i, i + batchSize);
                const validProducts: Partial<Product>[] = [];
                const batchErrors: any[] = [];
    
                // Validación manual de cada producto
                for (const productData of batch) {
                    try {
                        // Ejemplo de validación manual: verificar campos requeridos
                        if (!productData.reference || !productData.name) {
                            throw new Error('Reference and name are required');
                        }
    
                        const productEntity = this.productRepository.create(productData);
                        validProducts.push(productData);
                    } catch (error) {
                        batchErrors.push({
                            product: productData,
                            error: error.message
                        });
                    }
                }
    
                if (validProducts.length > 0) {
                    try {
                        const createdBatch = await transactionalEntityManager.save(
                            this.productRepository.create(validProducts)
                        );
    
                        for (const product of createdBatch) {
                            await this.productLogsService.createLog(
                                product.reference,
                                'CREATE',
                                null,
                                product
                            );
                        }
    
                        result.count += createdBatch.length;
                        result.products.push(...createdBatch);
                    } catch (error) {
                        batchErrors.push({
                            batch: validProducts,
                            error: error.message
                        });
                    }
                }
    
                result.errors.push(...batchErrors);
            }
        });
    
        return result;
    }

    async update(reference: string, updateData: Partial<Product>): Promise<Product> {
        const product = await this.findOne(reference);
        const oldData = { ...product };
        Object.assign(product, updateData);
        const updatedProduct = await this.productRepository.save(product);
        await this.productLogsService.createLog(reference, 'UPDATE', oldData, updatedProduct);
        return updatedProduct;
    }

    async remove(reference: string): Promise<void> {
        const product = await this.findOne(reference);
        await this.productRepository.remove(product);
        await this.productLogsService.createLog(reference, 'DELETE', product, null);
    }
}