import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductStock } from './entities/product-stock.entity'; // Asumo esta entidad
import { LogsService } from '../logs/logs.service';

@Injectable()
export class ProductStockService {
  constructor(
    @InjectRepository(ProductStock)
    private productStockRepository: Repository<ProductStock>,
    private readonly logsService: LogsService, // Inyectamos el LogsService
  ) {}

  async createBulk(
    stockData: Partial<ProductStock>[],
    batchSize = 100,
  ): Promise<{ count: number; stocks: ProductStock[]; errors: any[] }> {
    if (!stockData || stockData.length === 0) {
      throw new Error('No stock data provided for bulk creation');
    }

    const result = {
      count: 0,
      stocks: [] as ProductStock[],
      errors: [] as any[],
    };

    const stockIdentifierSet = new Set<string>();

    await this.productStockRepository.manager.transaction(async (transactionalEntityManager) => {
      for (let i = 0; i < stockData.length; i += batchSize) {
        const batch = stockData.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const stockItem of batch) {
          try {
            if (!stockItem.product_id || !stockItem.city_id || !stockItem.event_type) {
              throw new Error('Product_id, city_id, and event_type are required');
            }

            const stockIdentifier = `${stockItem.product_id}-${stockItem.city_id}`;
            if (stockIdentifierSet.has(stockIdentifier)) {
              throw new Error(`Duplicate stock entry for product '${stockItem.product_id}' in city '${stockItem.city_id}'`);
            }
            stockIdentifierSet.add(stockIdentifier);

            const existingStock = await this.productStockRepository.findOne({
              where: { product_id: stockItem.product_id, city_id: stockItem.city_id },
            });

            if (existingStock) {
              Object.assign(existingStock, stockItem, { processed: false });
              const updatedStock = await transactionalEntityManager.save(existingStock);

              result.stocks.push(updatedStock);

              // Log de actualización
              this.logsService.log({
                sync_type: 'stock',
                record_id: `${updatedStock.product_id}-${updatedStock.city_id}`,
                table_name: 'product_stock',
                event_type: 'UPDATE',
                result: 'exitoso',
              });
            } else {
              stockItem.processed = false;
              const newStock = this.productStockRepository.create(stockItem);
              const createdStock = await transactionalEntityManager.save(newStock);

              result.stocks.push(createdStock);

              // Log de creación
              this.logsService.log({
                sync_type: 'stock',
                record_id: `${createdStock.product_id}-${createdStock.city_id}`,
                table_name: 'product_stock',
                event_type: 'NEW',
                result: 'exitoso',
              });
            }

            result.count += 1;
          } catch (error) {
            batchErrors.push({
              stock: stockItem,
              error: error.message,
            });

            // Log de error
            this.logsService.log({
              sync_type: 'stock',
              record_id: stockItem.product_id ? `${stockItem.product_id}-${stockItem.city_id ?? 'N/A'}` : 'N/A',
              table_name: 'product_stock',
              event_type: 'ERROR',
              result: 'fallido',
              error_message: error.message,
            });
          }
        }

        result.errors.push(...batchErrors);
      }
    });

    return result;
  }
}