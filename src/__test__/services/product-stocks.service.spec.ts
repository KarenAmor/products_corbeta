import { Test, TestingModule } from '@nestjs/testing';
import { ProductStocksService } from '../../product_stock/product-stocks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductStock } from '../../product_stock/entities/product-stock.entity';
import { City } from '../../catalog/entities/city.entity';
import { ConfigService } from '@nestjs/config';
import { LogsService } from '../../logs/logs.service';
import { BadRequestException } from '@nestjs/common';
import { ProductStockOperationDto } from '../../product_stock/dto/create-product-stock.dto';

// Crear mocks de dependencias
const mockProductStockRepository = () => ({
  manager: {
    transaction: jest.fn().mockImplementation(fn =>
      fn({
        findOne: jest.fn(),
        save: jest.fn(),
        remove: jest.fn(),
      }),
    ),
  },
  create: jest.fn(),
});

const mockCityRepository = () => ({
  findOne: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(true), // Mock DELETE_RECORD as true by default
});

const mockLogsService = () => ({
  log: jest.fn(),
});

describe('ProductStocksService', () => {
  let service: ProductStocksService;
  let productStockRepository;
  let cityRepository;
  let logsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductStocksService,
        { provide: getRepositoryToken(ProductStock), useFactory: mockProductStockRepository },
        { provide: getRepositoryToken(City), useFactory: mockCityRepository },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: LogsService, useFactory: mockLogsService },
      ],
    }).compile();

    service = module.get<ProductStocksService>(ProductStocksService);
    productStockRepository = module.get(getRepositoryToken(ProductStock));
    cityRepository = module.get(getRepositoryToken(City));
    logsService = module.get(LogsService);
  });

  describe('createBulk', () => {
    it('should throw BadRequestException if no operations provided', async () => {
      await expect(service.createBulk([])).rejects.toThrow(BadRequestException);
      expect(productStockRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should process operations successfully when creating new stock', async () => {
      const mockOperation: ProductStockOperationDto = {
        business_unit: 'Test City',
        product_id: 'PROD001',
        stock: 50,
        is_active: 1,
      };

      const mockCity = { id: 1, name: 'Test City' };
      const savedStock = {
        id: 1,
        city_id: 1,
        product_id: 'PROD001',
        stock: 50,
        is_active: 1,
        created: new Date(),
        modified: new Date(),
      };

      productStockRepository.manager.transaction = jest.fn().mockImplementation(async cb => {
        await cb({
          findOne: jest
            .fn()
            .mockResolvedValueOnce(mockCity) // find City
            .mockResolvedValueOnce(null), // no existing Stock
          save: jest.fn().mockResolvedValue(savedStock),
        });
      });

      productStockRepository.create.mockReturnValue(savedStock);

      const result = await service.createBulk([mockOperation], 100);

      expect(result.response.status).toBe('successful');
      expect(result.response.message).toBe('Transaction Successful');
      expect(result.errors.length).toBe(0);
      expect(productStockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 'PROD001',
          city_id: 1,
          stock: 50,
          is_active: 1,
        }),
      );
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD001',
          process: 'product_stock',
          result: 'successful',
        }),
      );
    });

    it('should process operations successfully when updating existing stock', async () => {
      const mockOperation: ProductStockOperationDto = {
        business_unit: 'Test City',
        product_id: 'PROD001',
        stock: 75,
        is_active: 1,
      };

      const mockCity = { id: 1, name: 'Test City' };
      const existingStock = {
        id: 1,
        city_id: 1,
        product_id: 'PROD001',
        stock: 50,
        is_active: 1,
        created: new Date(),
        modified: new Date(),
      };
      const updatedStock = { ...existingStock, stock: 75, modified: new Date() };

      productStockRepository.manager.transaction = jest.fn().mockImplementation(async cb => {
        await cb({
          findOne: jest
            .fn()
            .mockResolvedValueOnce(mockCity) // find City
            .mockResolvedValueOnce(existingStock), // existing Stock
          save: jest.fn().mockResolvedValue(updatedStock),
        });
      });

      const result = await service.createBulk([mockOperation], 100);

      expect(result.response.status).toBe('successful');
      expect(result.response.message).toBe('Transaction Successful');
      expect(result.errors.length).toBe(0);
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD001',
          process: 'product_stock',
          result: 'successful',
        }),
      );
    });

    it('should process operations successfully when deleting stock (is_active: 0)', async () => {
      const mockOperation: ProductStockOperationDto = {
        business_unit: 'Test City',
        product_id: 'PROD001',
        stock: 0,
        is_active: 0,
      };

      const mockCity = { id: 1, name: 'Test City' };
      const existingStock = {
        id: 1,
        city_id: 1,
        product_id: 'PROD001',
        stock: 50,
        is_active: 1,
        created: new Date(),
        modified: new Date(),
      };

      productStockRepository.manager.transaction = jest.fn().mockImplementation(async cb => {
        await cb({
          findOne: jest
            .fn()
            .mockResolvedValueOnce(mockCity) // find City
            .mockResolvedValueOnce(existingStock), // existing Stock
          remove: jest.fn().mockResolvedValue(undefined),
        });
      });

      const result = await service.createBulk([mockOperation], 100);

      expect(result.response.status).toBe('successful');
      expect(result.response.message).toBe('Transaction Successful');
      expect(result.errors.length).toBe(0);
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD001',
          process: 'product_stock',
          result: 'deleted',
        }),
      );
    });

    it('should handle partial success when some operations fail', async () => {
      const operations: ProductStockOperationDto[] = [
        {
          business_unit: 'Test City',
          product_id: 'PROD001',
          stock: 50,
          is_active: 1,
        },
        {
          business_unit: '', // Missing business_unit, will cause error
          product_id: 'PROD002',
          stock: 100,
          is_active: 1,
        },
      ];

      const mockCity = { id: 1, name: 'Test City' };
      const savedStock = {
        id: 1,
        city_id: 1,
        product_id: 'PROD001',
        stock: 50,
        is_active: 1,
        created: new Date(),
        modified: new Date(),
      };

      productStockRepository.manager.transaction = jest.fn().mockImplementation(async cb => {
        await cb({
          findOne: jest
            .fn()
            .mockResolvedValueOnce(mockCity) // find City for PROD001
            .mockResolvedValueOnce(null) // no existing Stock for PROD001
            .mockResolvedValueOnce(null), // no City for PROD002 (missing business_unit)
          save: jest.fn().mockResolvedValue(savedStock),
        });
      });

      productStockRepository.create.mockReturnValue(savedStock);

      const result = await service.createBulk(operations, 100);

      expect(result.response.status).toBe('partial_success');
      expect(result.response.message).toContain('1 of 2 operations processed successfully');
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Missing required field(s): business_unit');
      expect(logsService.log).toHaveBeenCalledTimes(2); // Success for PROD001, error for PROD002
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD001',
          process: 'product_stock',
          result: 'successful',
        }),
      );
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD002',
          process: 'product_stock',
          result: 'failed',
          error_message: expect.stringContaining('Missing required field(s): business_unit'),
        }),
      );
    });

    it('should throw BadRequestException if all operations fail', async () => {
      const operations: ProductStockOperationDto[] = [
        {
          business_unit: '', // Missing business_unit
          product_id: 'PROD001',
          stock: 50,
          is_active: 1,
        },
      ];

      productStockRepository.manager.transaction = jest.fn().mockImplementation(async cb => {
        await cb({
          findOne: jest.fn().mockResolvedValueOnce(null), // no City (missing business_unit)
        });
      });

      await expect(service.createBulk(operations, 100)).rejects.toThrow(BadRequestException);
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD001',
          process: 'product_stock',
          result: 'failed',
          error_message: expect.stringContaining('Missing required field(s): business_unit'),
        }),
      );
    });

    it('should handle city not found error', async () => {
      const mockOperation: ProductStockOperationDto = {
        business_unit: 'Unknown City',
        product_id: 'PROD001',
        stock: 50,
        is_active: 1,
      };

      productStockRepository.manager.transaction = jest.fn().mockImplementation(async cb => {
        await cb({
          findOne: jest.fn().mockResolvedValueOnce(null), // no City
        });
      });

      await expect(
        service.createBulk([mockOperation], 100)
      ).rejects.toThrow(BadRequestException);
    
      expect(logsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'API',
          record_id: 'PROD001',
          process: 'product_stock',
          result: 'failed',
          error_message: expect.stringContaining('City not found for business_unit Unknown City'),
        }),
      );
    });
  });
});