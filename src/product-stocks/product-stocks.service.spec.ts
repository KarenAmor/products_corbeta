import { Test, TestingModule } from '@nestjs/testing';
import { ProductStockService } from '../product-stocks/product-stocks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductStock } from '../product-stocks/entities/product-stock.entity';
import { LogsService } from '../logs/logs.service';

describe('ProductStockService', () => {
  let service: ProductStockService;
  let productStockRepository: any;
  let logsServiceMock: any;

  beforeEach(async () => {
    productStockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      manager: {
        transaction: jest.fn(async (cb: (repo: any) => Promise<void>) => {
          await cb(productStockRepository);
        }),
      },
    };

    logsServiceMock = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductStockService,
        { provide: getRepositoryToken(ProductStock), useValue: productStockRepository },
        { provide: LogsService, useValue: logsServiceMock },
      ],
    }).compile();

    service = module.get<ProductStockService>(ProductStockService);
  });

  describe('createBulk', () => {
    it('should throw error if no stock data is provided', async () => {
      await expect(service.createBulk([])).rejects.toThrow(
        'No stock data provided for bulk creation'
      );
    });

    it('should create stock entries in bulk without logging errors', async () => {
      const stockData: Partial<ProductStock>[] = [
        { product_id: 'PROD1', city_id: 1, stock: 100, event_type: 'CREATE' },
        { product_id: 'PROD2', city_id: 2, stock: 50, event_type: 'UPDATE' },
        { product_id: 'PROD3', city_id: 3, stock: 75, event_type: 'UPDATE' },
      ];

      productStockRepository.create.mockImplementation((data) => data);
      productStockRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );
      productStockRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(stockData, 1);

      expect(result.count).toBe(3);
      expect(result.stocks.length).toBe(3);
      expect(result.errors.length).toBe(0);
      // Se esperan 3 llamadas al log: una por cada entrada exitosa
      expect(logsServiceMock.log).toHaveBeenCalledTimes(3);
    });

    it('should capture errors for invalid stock entries', async () => {
      const stockData: Partial<ProductStock>[] = [
        { product_id: 'PROD1', city_id: 1, stock: 100, event_type: 'CREATE' }, // válido
        { product_id: 'PROD1', city_id: 1, stock: 50, event_type: 'UPDATE' },  // duplicado (ya existe)
        { product_id: 'PROD2', city_id: 2, event_type: 'CREATE' },             // falta stock
      ];

      // Simula: el primer registro no existe, pero el duplicado ya existe en la BD
      productStockRepository.findOne
        .mockResolvedValueOnce(undefined) // para el primer registro
        .mockResolvedValueOnce({ product_id: 'PROD1', city_id: 1 }); // para el duplicado

      productStockRepository.create.mockImplementation((data) => data);
      productStockRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );

      const result = await service.createBulk(stockData, 2);

      // Sólo el primer registro es válido
      expect(result.count).toBe(1);
      expect(result.stocks.length).toBe(1);
      // Se esperan 2 errores: uno por duplicado y otro por falta de stock
      expect(result.errors.length).toBe(2);
      // Se espera 3 llamadas al log (1 éxito y 2 errores)
      expect(logsServiceMock.log).toHaveBeenCalledTimes(3);
    });
  });
});