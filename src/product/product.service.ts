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

    async create(productData: Partial<Product>): Promise<Product> {
        const product = this.productRepository.create(productData);
        const savedProduct = await this.productRepository.save(product);
        await this.productLogsService.createLog(savedProduct.reference, 'CREATE', null, savedProduct);
        return savedProduct;
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