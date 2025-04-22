import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CatalogService } from '../../catalog/catalog.service';
import { Catalog } from '../../catalog/entities/catalog.entity';
import { City } from '../../catalog/entities/city.entity';
import { LogsService } from '../../logs/logs.service';
import { BadRequestException } from '@nestjs/common';

describe('CatalogService', () => {
  let service: CatalogService;
  let catalogRepository: jest.Mocked<Repository<Catalog>>;
  let cityRepository: jest.Mocked<Repository<City>>;
  let logsService: jest.Mocked<LogsService>;
  let managerMock: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    // Mock del EntityManager
    managerMock = {
      findOne: jest.fn(),
      save: jest.fn(),
      transaction: jest.fn().mockImplementation((fn) => fn(managerMock)),
    } as any;

    // Mock del repositorio de Catalog
    catalogRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      manager: managerMock,
    } as any;

    // Mock del repositorio de City
    cityRepository = {
      findOne: jest.fn(),
      manager: managerMock,
    } as any;

    // Mock del LogsService
    logsService = {
      log: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(Catalog), useValue: catalogRepository },
        { provide: getRepositoryToken(City), useValue: cityRepository },
        { provide: LogsService, useValue: logsService },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  // Caso 1: Éxito total
  it('debería insertar todos los catálogos exitosamente', async () => {
    const rawCatalogs = [
      { name_catalog: 'Catalog 1', business_unit: 'City1', is_active: 1 },
      { name_catalog: 'Catalog 2', business_unit: 'City2', is_active: 0 },
    ];

    // Configuración de mocks
    managerMock.findOne.mockImplementation((entity, options) => {
        if (
          entity === City &&
          options &&
          !Array.isArray(options.where) &&
          options.where?.name === 'City1'
        ) {
          return Promise.resolve({ id: 1, name: 'City1' });
        }
      
        if (
          entity === City &&
          options &&
          !Array.isArray(options.where) &&
          options.where?.name === 'City2'
        ) {
          return Promise.resolve({ id: 2, name: 'City2' });
        }
      
        if (
          entity === Catalog &&
          options &&
          !Array.isArray(options.where) &&
          options.where?.name === 'Catalog 1' &&
          options.where?.city_id === 1
        ) {
          return Promise.resolve(null); // No existe aún
        }
      
        if (
          entity === Catalog &&
          options &&
          !Array.isArray(options.where) &&
          options.where?.name === 'Catalog 2' &&
          options.where?.city_id === 2
        ) {
          return Promise.resolve(null); // No existe aún
        }
      
        return Promise.resolve(null);
      });      
      
     managerMock.save
      .mockResolvedValueOnce({ id: 1, ...rawCatalogs[0] })
      .mockResolvedValueOnce({ id: 2, ...rawCatalogs[1] });

    const result = await service.createBulk(rawCatalogs);

    // Verificaciones
    expect(result.response.code).toBe(200);
    expect(result.response.message).toBe('2 of 2 catalogs inserted successfully');
    expect(result.response.status).toBe('successful');
    expect(result.errors).toHaveLength(0);
    expect(logsService.log).toHaveBeenCalledTimes(2); // Dos logs de éxito
  });

  // Caso 2: Éxito parcial
  it('debería manejar éxito parcial con errores', async () => {
    const rawCatalogs = [
      { name_catalog: 'Catalog 1', business_unit: 'City1', is_active: 1 },
      { name_catalog: 'Catalog 2', business_unit: 'City2', is_active: 'invalid' }, // Tipo incorrecto
    ];

    // Configuración de mocks
    managerMock.findOne.mockResolvedValueOnce({ id: 1, name: 'City1' }); // Ciudad para Catalog 1
    catalogRepository.create.mockImplementation((data) => data as Catalog);
    managerMock.save.mockResolvedValueOnce({ id: 1, ...rawCatalogs[0] });

    const result = await service.createBulk(rawCatalogs);

    // Verificaciones
    expect(result.response.code).toBe(200);
    expect(result.response.message).toBe('1 of 2 catalogs inserted successfully');
    expect(result.response.status).toBe('partial_success');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Invalid field values');
    expect(logsService.log).toHaveBeenCalledTimes(2); // Un éxito, un error
  });

  // Caso 3: Fallo total
  it('debería lanzar BadRequestException si todos los catálogos son inválidos', async () => {
    const rawCatalogs = [
      { name_catalog: '', business_unit: 'City1', is_active: 1 }, // Nombre vacío
      { name_catalog: 'Catalog 2', business_unit: '', is_active: 0 }, // Unidad vacía
    ];

    await expect(service.createBulk(rawCatalogs)).rejects.toThrow(BadRequestException);
    expect(logsService.log).toHaveBeenCalledTimes(2); // Dos logs de error
  });

  // Caso 4: Duplicados en el lote
  it('debería manejar catálogos duplicados en el lote', async () => {
    const rawCatalogs = [
      { name_catalog: 'Catalog 1', business_unit: 'City1', is_active: 1 },
      { name_catalog: 'Catalog 1', business_unit: 'City1', is_active: 0 }, // Duplicado
    ];

    // Configuración de mocks
    managerMock.findOne.mockResolvedValueOnce({ id: 1, name: 'City1' }); // Ciudad para ambos
    catalogRepository.create.mockImplementation((data) => data as Catalog);
    managerMock.save.mockResolvedValueOnce({ id: 1, ...rawCatalogs[0] });

    const result = await service.createBulk(rawCatalogs);

    // Verificaciones
    expect(result.response.code).toBe(200);
    expect(result.response.message).toBe('1 of 2 catalogs inserted successfully');
    expect(result.response.status).toBe('partial_success');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Duplicate catalog');
    expect(logsService.log).toHaveBeenCalledTimes(2); // Un éxito, un error
  });

  // Caso 5: Array vacío
  it('debería lanzar BadRequestException si no se proporcionan catálogos', async () => {
    await expect(service.createBulk([])).rejects.toThrow(BadRequestException);
    expect(logsService.log).not.toHaveBeenCalled();
  });
});