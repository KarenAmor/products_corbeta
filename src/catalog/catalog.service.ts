import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config'
import { Repository } from 'typeorm';
import { Catalog } from './entities/catalog.entity';
import { City } from './entities/city.entity';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Catalog, 'corbemovilTempConnection')
    private catalogTempRepository: Repository<Catalog>,
    @InjectRepository(Catalog, 'corbemovilConnection')
    private catalogRepository: Repository<Catalog>,
    @InjectRepository(City, 'corbemovilConnection')
    private cityRepository: Repository<City>,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {}

  async createBulk(
    rawCatalogs: any[],
    batchSize = 100,
  ): Promise<{ response: { code: number; message: string; status: string }; errors: any[] }> {
    if (!rawCatalogs || rawCatalogs.length === 0) {
      throw new BadRequestException({
        response: {
          code: 400,
          message: 'No catalogs provided in the array',
          status: 'failed',
        },
        errors: [],
      });
    }

      // Obtener flags de configuración
      const VALIDATE_BD_TEMP = this.configService.get<boolean>('VALIDATE_BD_TEMP');

    const result = {
      count: 0,
      catalogs: [] as Catalog[],
      errors: [] as any[],
    };

    const cityCache = new Map<string, number>();

    await this.catalogRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < rawCatalogs.length; i += batchSize) {
        const batch = rawCatalogs.slice(i, i + batchSize);
        const batchErrors: any[] = [];

        for (const [index, raw] of batch.entries()) {
          try {
            const missingFields: string[] = [];
            const invalidFields: string[] = [];

            const { name_catalog, business_unit, is_active } = raw;

            if (!name_catalog || typeof name_catalog !== 'string') {
              missingFields.push('name_catalog');
            }

            if (!business_unit || typeof business_unit !== 'string') {
              missingFields.push('business_unit');
            }

            if (is_active === undefined || is_active === null) {
              missingFields.push('is_active');
            }

            if (missingFields.length > 0) {
              throw new Error(`Missing or invalid fields: ${missingFields.join(', ')}`);
            }

            const name = name_catalog.trim();
            const businessUnitName = business_unit.trim();

            if (name.length > 20) {
              invalidFields.push('name_catalog: max 20 characters');
            }

            if (typeof is_active !== 'number' || ![0, 1].includes(is_active)) {
              invalidFields.push('is_active must be 0 or 1');
            }
            

            if (invalidFields.length > 0) {
              throw new Error(`Invalid field values: ${invalidFields.join(', ')}`);
            }

            let city_id = cityCache.get(businessUnitName);

            if (!city_id) {
              const city = await this.cityRepository.findOne( {
                select: ['id', 'name'],
                where: { name: businessUnitName },
              });

              if (!city) {
                throw new Error(`Business unit '${businessUnitName}' not found`);
              }

              city_id = city.id;
              cityCache.set(businessUnitName, city_id);
            }

            const catalogData: Partial<Catalog> = {
              name,
              city_id,
              is_active,
            };

            let existing: any = null;

						if (VALIDATE_BD_TEMP)
						{
							existing = await this.catalogTempRepository.findOne({select: ['id', 'name', 'city_id'], where: {name,city_id,}});
						}else{
							existing = await this.catalogRepository.findOne({select: ['id', 'name', 'city_id'],where: {name,city_id,}});
						}

            let savedCatalog: Catalog;

            if (existing) {
              Object.assign(existing, catalogData);
              savedCatalog = await this.catalogTempRepository.save(existing);
            } else {
              const newCatalog = this.catalogRepository.create(catalogData as Catalog);
              savedCatalog = await this.catalogTempRepository.save(newCatalog);
            }

            // Log de éxito
            try {
              this.logsService.log({
                sync_type: 'API',
                record_id: name,
                process: 'catalog',
                row_data: JSON.parse(JSON.stringify(raw)),
                event_date: new Date(),
                result: 'successful',
              });
            } catch (logError) {
              console.warn(`Failed to log success for catalog ${savedCatalog.name}: ${logError.message}`);
            }

            result.catalogs.push(savedCatalog);
            result.count += 1;
          } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            batchErrors.push({
              catalog: raw,
              error: errorMessage,
              index: i + index,
            });

            try {
              const recordId = raw?.name_catalog || `INVALID_INDEX_${i + index}`;
              this.logsService.log({
                sync_type: 'API',
                record_id: recordId,
                process: 'catalog',
                row_data: JSON.parse(JSON.stringify(raw)),
                event_date: new Date(),
                result: 'failed',
                error_message: errorMessage,
              });
            } catch (logError) {
              console.warn(`Failed to log error for catalog at index ${i + index}: ${logError.message}`);
            }
          }
        }

        result.errors.push(...batchErrors);
      }
    });

    const total = rawCatalogs.length;
    const success = result.count;

    if (success === 0) {
      throw new BadRequestException({
        response: {
          code: 400,
          message: 'All catalogs contain invalid data',
          status: 'failed',
        },
        errors: result.errors,
      });
    }

    return {
      response: {
        code: 200,
        message: `${success} of ${total} catalogs inserted successfully`,
        status: success === total ? 'successful' : 'partial_success',
      },
      errors: result.errors,
    };
  }
}