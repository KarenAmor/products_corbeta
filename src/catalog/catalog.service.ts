import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Catalog } from './entities/catalog.entity';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Catalog)
    private catalogRepository: Repository<Catalog>,
    private readonly logsService: LogsService,
  ) {}

  async createBulk(
    catalogsData: Partial<Catalog>[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {
    if (!catalogsData || catalogsData.length === 0) {
      throw new BadRequestException({
        response: {
          code: 400,
          message: 'No catalogs provided in the array',
          status: 'failed',
        },
        errors: [],
      });
    }

    const result = {
      count: 0,
      catalogs: [] as Catalog[],
      errors: [] as any[],
    };

    // Set para validar duplicados dentro del mismo lote
    const catalogKeySet = new Set<string>();

    await this.catalogRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < catalogsData.length; i += batchSize) {
        const batch = catalogsData.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, catalogData] of batch.entries()) {
          try {
            const missingFields: string[] = [];
            const invalidFields: string[] = [];

            // Validar campos requeridos
            if (typeof catalogData.name !== 'string' || !catalogData.name.trim()) {
                missingFields.push('name');
              }              
            if (catalogData.city_id === undefined || catalogData.city_id === null) missingFields.push('city_id');
            if (catalogData.is_active === undefined || catalogData.is_active === null)
              missingFields.push('is_active');

            // Si faltan campos requeridos, lanzar error
            if (missingFields.length > 0) {
              throw new Error(`Missing, empty or null fields: ${missingFields.join(', ')}`);
            }

// Validar tipo de datos y longitud
            if (typeof catalogData.name !== 'string' || catalogData.name.length > 20) {
              invalidFields.push('name: expected string up to 20 characters');
            }

            if (typeof catalogData.city_id !== 'number') {
              invalidFields.push('city_id: expected number');
            }

            if (typeof catalogData.is_active !== 'number') {
              invalidFields.push('is_active: expected number (0 or 1)');
            }

            // Validar duplicados en lote (name + city_id)
            const uniqueKey = `${(catalogData.name || '').trim().toLowerCase()}-${catalogData.city_id}`;
            if (catalogKeySet.has(uniqueKey)) {
              throw new Error(`Duplicate catalog (name + city_id) in batch: '${catalogData.name}'`);
            }
            catalogKeySet.add(uniqueKey);

            // Buscar si ya existe en base de datos
            const existing = await manager.findOne(Catalog, {
                where: {
                  name: catalogData.name!.trim(),
                  city_id: catalogData.city_id,
                },
              });  

            let savedCatalog: Catalog;

            // Si existe, actualizar; si no, insertar
            if (existing) {
              Object.assign(existing, catalogData);
              savedCatalog = await manager.save(existing);
            } else {
              const newCatalog = this.catalogRepository.create(catalogData as Catalog);
              savedCatalog = await manager.save(newCatalog);
            }

            // Registrar log de éxito (omitimos campos automáticos)
            const { created, modified, ...logRowData } = savedCatalog;
            this.logsService.log({
              sync_type: 'API',
              record_id: `${savedCatalog.id}`,
              process: 'catalog',
              row_data: logRowData,
              event_date: new Date(),
              result: 'successful',
            });

            result.catalogs.push(savedCatalog);
            result.count += 1;
          } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            // Guardar error individual en la respuesta
            batchErrors.push({
              catalog: catalogData,
              error: errorMessage,
              index: i + index,
            });

            // Registrar log de error
            const { created, modified, ...logErrorData } = catalogData;
            this.logsService.log({
              sync_type: 'API',
              record_id: `INVALID_ID_${i + index}`,
              process: 'catalog',
              row_data: logErrorData,
              event_date: new Date(),
              result: 'failed',
              error_message: errorMessage,
            });
          }
        }

        // Agregar errores del batch al resultado final
        result.errors.push(...batchErrors);
      }
    });

    const total = catalogsData.length;
    const successful = result.count;
    const failed = result.errors.length;

    let status: string;
    let message: string;

    // Construir la respuesta según el resultado
    if (successful === total) {
      status = 'successful';
      message = 'Transaction Successful';
    } else if (failed === total) {
      status = 'failed';
      message = 'All catalogs contain invalid data';
      throw new BadRequestException({
        response: { code: 400, message, status },
        errors: result.errors,
      });
    } else {
      status = 'partial_success';
      message = `${successful} of ${total} catalogs inserted successfully`;
    }

    return {
      response: { code: 200, message, status },
      errors: result.errors,
    };
  }
}