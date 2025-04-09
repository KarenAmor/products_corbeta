import { Injectable } from '@nestjs/common';
// Indica que esta clase es un servicio que puede ser inyectado en otros componentes de la aplicación usando el framework NestJS.

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
// Importa herramientas para interactuar con la base de datos usando TypeORM. "Product" es la entidad que define la estructura de la tabla de productos.

import { LogsService } from '../logs/logs.service';
// Importa un servicio para registrar logs de las operaciones realizadas.

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private readonly logsService: LogsService,
  ) {}
  // El constructor inyecta el repositorio de productos (para operaciones en la base de datos) y el servicio de logs.

  async createBulk(
    productsData: Partial<Product>[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {
    // Este método crea o actualiza productos en masa. Recibe un array de datos parciales de productos y un tamaño de lote opcional (por defecto 100).

    if (!productsData || productsData.length === 0) {
      throw new Error('No products provided for bulk creation');
      // Verifica que se haya proporcionado al menos un producto; si no, lanza un error.
    }

    const result = {
      count: 0,
      products: [] as Product[],
      errors: [] as any[],
    };
    // Define un objeto para almacenar el conteo de productos procesados, los productos creados/actualizados y los errores encontrados.

    const referenceSet = new Set<string>();
    // Un conjunto para rastrear referencias únicas y evitar duplicados dentro del lote.

    await this.productRepository.manager.transaction(async (transactionalEntityManager) => {
      // Inicia una transacción para asegurar que todas las operaciones se realicen de forma atómica (si algo falla, se revierte todo).

      for (let i = 0; i < productsData.length; i += batchSize) {
        const batch = productsData.slice(i, i + batchSize);
        // Divide el array de productos en lotes según el tamaño definido (batchSize).

        const batchErrors: any[] = [];
        // Array para almacenar errores específicos de cada lote.

        for (const [index, productData] of batch.entries()) {
          try {
            // Itera sobre cada producto en el lote e intenta procesarlo.

            // Validación de campos requeridos
            const missingFields: string[] = [];
            if (productData.reference === undefined || productData.reference === null) missingFields.push('reference');
            if (productData.name === undefined || productData.name === null) missingFields.push('name');
            if (productData.packing === undefined || productData.packing === null) missingFields.push('packing');
            if (productData.convertion_rate === undefined || productData.convertion_rate === null) missingFields.push('convertion_rate');
            if (productData.vat_group === undefined || productData.vat_group === null) missingFields.push('vat_group');
            if (productData.vat === undefined || productData.vat === null) missingFields.push('vat');
            if (productData.packing_to === undefined || productData.packing_to === null) missingFields.push('packing_to');
            if (productData.is_active === undefined || productData.is_active === null) missingFields.push('is_active');
            // Verifica que los campos obligatorios estén presentes; si falta alguno, lo agrega a la lista de campos faltantes.

            if (missingFields.length > 0) {
              throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
              // Si hay campos faltantes, lanza un error con los nombres de los campos.
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
            // Verifica que ciertos campos tengan el tipo correcto (número); si no, lanza un error.

            const reference = productData.reference as string;
            if (referenceSet.has(reference)) {
              throw new Error(`Duplicate reference '${reference}' in the batch`);
            }
            referenceSet.add(reference);
            // Verifica que no haya referencias duplicadas en el lote; si las hay, lanza un error.

            const existingProduct = await this.productRepository.findOne({
              where: { reference },
            });
            // Busca en la base de datos si ya existe un producto con la misma referencia.

            if (existingProduct) {
              Object.assign(existingProduct, productData);
              const updatedProduct = await transactionalEntityManager.save(existingProduct);
              result.products.push(updatedProduct);
              // Si el producto existe, lo actualiza con los nuevos datos y lo guarda.

              this.logsService.log({
                sync_type: 'API',
                record_id: updatedProduct.reference.toString(),
                table_name: 'product',
                data: updatedProduct,
                event_date: new Date(),
                result: 'successful', 
              });
              // Registra un log exitoso para la actualización.
            } else {
              const newProduct = this.productRepository.create(productData as Product);
              const createdProduct = await transactionalEntityManager.save(newProduct);
              result.products.push(createdProduct);
              // Si no existe, crea un nuevo producto y lo guarda.

              this.logsService.log({
                sync_type: 'API',
                record_id: createdProduct.reference.toString(),
                table_name: 'product',
                data: createdProduct,
                event_date: new Date(),
                result: 'successful', 
              });
              // Registra un log exitoso para la creación.
            }

            result.count += 1;
            // Incrementa el contador de productos procesados con éxito.
          } catch (error) {
            batchErrors.push({
              product: productData,
              error: error.message,
              index: i + index,
            });
            // Si ocurre un error, lo captura y lo agrega al array de errores del lote.

            this.logsService.log({
              sync_type: 'API',
              record_id: (productData.reference as string | undefined) ?? 'N/A',
              table_name: 'product',
              data: productData,
              event_date: new Date(),
              result: 'failed', 
              error_message: error.message,
            });
            // Registra un log de fallo con el mensaje de error.
          }
        }

        result.errors.push(...batchErrors);
        // Agrega los errores del lote al resultado global.
      }
    });

    const totalProducts = productsData.length;
    const successfulProducts = result.count;
    const failedProducts = result.errors.length;
    // Calcula estadísticas: total de productos, éxitos y fallos.

    let status: string;
    let message: string;

    if (successfulProducts === totalProducts) {
      status = 'successful'; 
      message = 'Transaction Successful';
      // Si todos los productos se procesaron correctamente, el estado es "exitoso".
    } else if (failedProducts === totalProducts) {
      status = 'failed'; 
      message = `${successfulProducts} of ${totalProducts} products inserted successfully`; 
      // Si todos fallaron, el estado es "fallido".
    } else {
      status = 'partial_success'; 
      message = `${successfulProducts} of ${totalProducts} products inserted successfully`; 
      // Si algunos fallaron y otros no, el estado es "éxito parcial".
    }

    return {
      response: {
        code: 200,
        message,
        status,
      },
      errors: result.errors,
    };
    // Devuelve un objeto con la respuesta (código, mensaje, estado) y la lista de errores.
  }
}