import { Test, TestingModule } from '@nestjs/testing';
import { ProductPricesService } from '../../price/price.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductPrice } from '../../price/entities/product-price.entity';
import { Catalog } from '../../catalog/entities/catalog.entity';
import { City } from '../../catalog/entities/city.entity';
import { ConfigService } from '@nestjs/config';
import { LogsService } from '../../logs/logs.service';
import { BadRequestException } from '@nestjs/common';

// Crear mocks de dependencias
const mockProductPriceRepository = () => ({
  manager: {
    transaction: jest.fn().mockImplementation(fn => fn({
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    })),
  },
  create: jest.fn(),
});

const mockCatalogRepository = () => ({
  findOne: jest.fn(),
});

const mockCityRepository = () => ({
  findOne: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(true),
});

const mockLogsService = () => ({
  log: jest.fn(),
});

describe('ProductPricesService', () => {
  let service: ProductPricesService;
  let productPriceRepository;
  let catalogRepository;
  let cityRepository;
  let logsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductPricesService,
        { provide: getRepositoryToken(ProductPrice), useFactory: mockProductPriceRepository },
        { provide: getRepositoryToken(Catalog), useFactory: mockCatalogRepository },
        { provide: getRepositoryToken(City), useFactory: mockCityRepository },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: LogsService, useFactory: mockLogsService },
      ],
    }).compile();

    service = module.get<ProductPricesService>(ProductPricesService);
    productPriceRepository = module.get(getRepositoryToken(ProductPrice));
    catalogRepository = module.get(getRepositoryToken(Catalog));
    cityRepository = module.get(getRepositoryToken(City));
    logsService = module.get(LogsService);
  });

  describe('createBulk', () => {
    it('should throw BadRequestException if no operations provided', async () => {
      await expect(service.createBulk([])).rejects.toThrow(BadRequestException);
    });

    it('should process operations successfully', async () => {
      const mockOperation = {
        business_unit: 'Test City',
        catalog: 'Test Catalog',
        product_id: 'PROD001',
        price: 100,
        vlr_impu_consumo: 10,
        is_active: 1,
      };

      const mockCity = { id: 1, name: 'Test City' };
      const mockCatalog = { id: 2, name: 'Test Catalog', city_id: 1 };
      const savedPrice = { id: 1, catalog_id: 2, product_reference: 'PROD001', price: 100, vlr_impu_consumo: 10, is_active: 1 };

      productPriceRepository.manager.transaction = jest.fn().mockImplementation(async (cb) => {
        await cb({
          findOne: jest.fn()
            .mockResolvedValueOnce(mockCity)     // find City
            .mockResolvedValueOnce(mockCatalog)  // find Catalog
            .mockResolvedValueOnce(null),        // no existing Price
          save: jest.fn().mockResolvedValue(savedPrice),
        });
      });

      productPriceRepository.create.mockReturnValue(savedPrice);

      const result = await service.createBulk([mockOperation]);

      expect(result.response.status).toBe('successful');
      expect(result.errors.length).toBe(0);
      expect(logsService.log).toHaveBeenCalled();
    });

    it('should handle partial success when some operations fail', async () => {
      const operations = [
        {
          business_unit: 'Test City',
          catalog: 'Test Catalog',
          product_id: 'PROD001',
          price: 100,
          vlr_impu_consumo: 10,
          is_active: 1,
        },
        {
          business_unit: '',  // <-- Este provocará error
          catalog: 'Test Catalog',
          product_id: 'PROD002',
          price: 200,
          vlr_impu_consumo: 20,
          is_active: 1,
        },
      ];

      const mockCity = { id: 1, name: 'Test City' };
      const mockCatalog = { id: 2, name: 'Test Catalog', city_id: 1 };
      const savedPrice = { id: 1, catalog_id: 2, product_reference: 'PROD001', price: 100, vlr_impu_consumo: 10, is_active: 1 };

      productPriceRepository.manager.transaction = jest.fn().mockImplementation(async (cb) => {
        await cb({
          findOne: jest.fn()
            .mockResolvedValueOnce(mockCity)
            .mockResolvedValueOnce(mockCatalog)
            .mockResolvedValueOnce(null),
          save: jest.fn().mockResolvedValue(savedPrice),
        });
      });

      productPriceRepository.create.mockReturnValue(savedPrice);

      const result = await service.createBulk(operations);

      expect(result.response.status).toBe('partial_success');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(logsService.log).toHaveBeenCalled();
    });
  });
});
