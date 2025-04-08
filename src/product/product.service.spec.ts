import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { LogsService } from '../logs/logs.service';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: any;
  let logsServiceMock: any;

  beforeEach(async () => {
    productRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      manager: {
        transaction: jest.fn(async (cb: (repo: any) => Promise<void>) => {
          await cb(productRepository);
        }),
      },
    };

    logsServiceMock = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: LogsService, useValue: logsServiceMock },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('createBulk', () => {
    it('should throw error if no products are provided', async () => {
      await expect(service.createBulk([])).rejects.toThrow(
        'No products provided for bulk creation',
      );
    });

    it('should create products in bulk successfully', async () => {
      const productsData: Partial<Product>[] = [
        {
          reference: 'ref1',
          name: 'Product 1',
          packing: 'UNI',
          convertion_rate: 1,
          vat_group: 'Group A',
          vat: 0.1,
          packing_to: 'CAJ',
          is_active: 1,
        },
        {
          reference: 'ref2',
          name: 'Product 2',
          packing: 'CAJ',
          convertion_rate: 2,
          vat_group: 'Group B',
          vat: 0.2,
          packing_to: 'PAL',
          is_active: 0,
        },
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 1);

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('Transacción Exitosa');
      expect(result.response.status).toBe('exitoso');
      expect(result.errors.length).toBe(0);
      expect(productRepository.save).toHaveBeenCalledTimes(2);
      expect(logsServiceMock.log).toHaveBeenCalledTimes(2);
    });

    it('should capture errors for invalid products with partial success', async () => {
      const productsData: Partial<Product>[] = [
        {
          reference: 'ref1',
          name: 'Product 1',
          packing: 'UNI',
          convertion_rate: 1,
          vat_group: 'Group A',
          vat: 0.1,
          packing_to: 'CAJ',
          is_active: 1,
        }, // Válido
        {
          reference: 'ref1',
          name: 'Duplicado',
          packing: 'CAJ',
          convertion_rate: 2,
          vat_group: 'Group B',
          vat: 0.2,
          packing_to: 'PAL',
          is_active: 0,
        }, // Duplicado
        {
          reference: 'ref3',
          packing: 'PAL',
          convertion_rate: 3,
          vat_group: 'Group C',
          vat: 0.3,
          packing_to: 'UNI',
          is_active: 1,
        }, // Falta name
        {
          reference: 'ref4',
          name: 'Product 4',
          packing: 'UNI',
          convertion_rate: 'invalid' as any, // Tipo incorrecto
          vat_group: 'Group D',
          vat: 0.4,
          packing_to: 'CAJ',
          is_active: 1,
        }, // Tipo incorrecto en convertion_rate
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 2);

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('1 de 4 productos insertados correctamente');
      expect(result.response.status).toBe('partial_success');
      expect(result.errors.length).toBe(3);
      expect(result.errors[0].error).toBe("Duplicate reference 'ref1' in the batch");
      expect(result.errors[1].error).toBe('Missing required fields: name');
      expect(result.errors[2].error).toContain('Invalid type for convertion_rate');
      expect(logsServiceMock.log).toHaveBeenCalledTimes(4); // 1 éxito + 3 fallos
    });

    it('should return failed status when all products fail', async () => {
      const productsData: Partial<Product>[] = [
        {
          reference: 'ref1',
          name: 'Product 1',
          packing: 'UNI',
          convertion_rate: 'invalid' as any, // Tipo incorrecto
          vat_group: 'Group A',
          vat: 0.1,
          packing_to: 'CAJ',
          is_active: 1,
        },
        {
          reference: 'ref2',
          packing: 'CAJ',
          convertion_rate: 2,
          vat_group: 'Group B',
          vat: 0.2,
          packing_to: 'PAL',
          is_active: 0,
        }, // Falta name
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 2);

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('0 de 2 productos insertados correctamente');
      expect(result.response.status).toBe('fallido');
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].error).toContain('Invalid type for convertion_rate');
      expect(result.errors[1].error).toBe('Missing required fields: name');
      expect(logsServiceMock.log).toHaveBeenCalledTimes(2); // 2 fallos
    });

    it('should update existing product successfully', async () => {
      const productsData: Partial<Product>[] = [
        {
          reference: 'ref1',
          name: 'Updated Product',
          packing: 'UNI',
          convertion_rate: 1,
          vat_group: 'Group A',
          vat: 0.1,
          packing_to: 'CAJ',
          is_active: 1,
        },
      ];

      const existingProduct = {
        reference: 'ref1',
        name: 'Original Product',
        packing: 'CAJ',
        convertion_rate: 2,
        vat_group: 'Group B',
        vat: 0.2,
        packing_to: 'PAL',
        is_active: 0,
      };

      productRepository.findOne.mockResolvedValue(existingProduct);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );

      const result = await service.createBulk(productsData, 1);

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('Transacción Exitosa');
      expect(result.response.status).toBe('exitoso');
      expect(result.errors.length).toBe(0);
      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Product' }),
      );
      expect(logsServiceMock.log).toHaveBeenCalledTimes(1);
    });
  });
});