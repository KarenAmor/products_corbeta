import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { instanceToPlain } from 'class-transformer';
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
    
        // Conjunto para rastrear referencias únicas y evitar duplicados
        const referenceSet = new Set<string>();
    
        await this.productRepository.manager.transaction(async (transactionalEntityManager) => {
            for (let i = 0; i < productsData.length; i += batchSize) {
                const batch = productsData.slice(i, i + batchSize);
                const batchErrors: any[] = [];
    
                for (const productData of batch) {
                    try {
                        // Validar campos requeridos
                        if (!productData.reference || !productData.name) {
                            throw new Error('Reference and name are required');
                        }
    
                        // Validar unicidad de reference
                        if (referenceSet.has(productData.reference)) {
                            throw new Error(`Duplicate reference '${productData.reference}'`);
                        }
    
                        referenceSet.add(productData.reference);
    
                        // Crear y guardar el producto individualmente
                        const productEntity = this.productRepository.create(productData);
                        const createdProduct = await transactionalEntityManager.save(productEntity);
    
                        // Registrar el log del producto creado
                        await this.productLogsService.createLog(
                            createdProduct.reference,
                            'CREATE',
                            null,
                            instanceToPlain(createdProduct)
                        );
    
                        result.count += 1;
                        result.products.push(createdProduct);
                    } catch (error) {
                        batchErrors.push({
                            product: productData,
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
        const oldData = instanceToPlain(product);
        Object.assign(product, updateData);
        const updatedProduct = await this.productRepository.save(product);
        await this.productLogsService.createLog(reference, 'UPDATE', oldData, instanceToPlain(updatedProduct));
        return updatedProduct;
    }

    async remove(reference: string): Promise<void> {
        const product = await this.findOne(reference);
        await this.productRepository.remove(product);
        await this.productLogsService.createLog(reference, 'DELETE', instanceToPlain(product), null);
    }
}