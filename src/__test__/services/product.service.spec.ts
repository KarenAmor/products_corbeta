import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from '../../product/product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../../product/entities/product.entity';
import { LogsService } from '../../logs/logs.service';
import { BadRequestException } from '@nestjs/common';

describe('ProductService', () => {
  // Define un conjunto de pruebas para el ProductService
  let service: ProductService;
  let productRepository: any;
  let logsServiceMock: any;

  beforeEach(async () => {
    // Configura el entorno antes de cada prueba
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
    // Define un subconjunto de pruebas específicas para el método createBulk
    it('should throw BadRequestException if no products are provided', async () => {
      // Prueba que verifica si se lanza una excepción cuando no se proporcionan productos
      await expect(service.createBulk([])).rejects.toThrow(BadRequestException);
      await expect(service.createBulk([])).rejects.toMatchObject({
        response: {
          response: {
            code: 400,
            message: 'No products provided in the products array',
            status: 'failed',
          },
          errors: [],
        },
      });
    });

    it('should create products in bulk successfully', async () => {
      // Prueba que verifica la creación exitosa de productos en masa
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

      expect(result.response.code).toBe(201);
      expect(result.response.message).toBe('Transaction Successful');
      expect(result.response.status).toBe('successful');
      expect(result.errors.length).toBe(0);
      expect(productRepository.save).toHaveBeenCalledTimes(2);
      expect(logsServiceMock.log).toHaveBeenCalledTimes(2);
    });

    it('should capture errors for invalid products with partial success', async () => {
      // Prueba que verifica el manejo de errores con éxito parcial
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
          reference: 'ref1',
          name: 'Duplicado',
          packing: 'CAJ',
          convertion_rate: 2,
          vat_group: 'Group B',
          vat: 0.2,
          packing_to: 'PAL',
          is_active: 0,
        },
        {
          reference: 'ref3',
          packing: 'PAL',
          convertion_rate: 3,
          vat_group: 'Group C',
          vat: 0.3,
          packing_to: 'UNI',
          is_active: 1,
        },
        {
          reference: 'ref4',
          name: 'Product 4',
          packing: 'UNI',
          convertion_rate: 'invalid' as any,
          vat_group: 'Group D',
          vat: 0.4,
          packing_to: 'CAJ',
          is_active: 1,
        },
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 2);

      expect(result.response.code).toBe(201);
      expect(result.response.message).toBe('1 of 4 products inserted successfully');
      expect(result.response.status).toBe('partial_success');
      expect(result.errors.length).toBe(3);
      expect(result.errors[0].error).toBe("Duplicate reference 'ref1' in the batch");
      expect(result.errors[1].error).toBe('Missing, empty or null fields: name');
      expect(result.errors[2].error).toContain('Invalid fields: convertion_rate: expected number, got string');
      expect(logsServiceMock.log).toHaveBeenCalledTimes(4);
    });

    it('should throw BadRequestException when all products are invalid', async () => {
      // Prueba que verifica la excepción cuando todos los productos son inválidos
      const productsData: Partial<Product>[] = [
        {
          reference: 'ref1',
          name: 'Product 1',
          packing: 'UNI',
          convertion_rate: 'invalid' as any,
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
        },
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      await expect(service.createBulk(productsData, 2)).rejects.toThrow(BadRequestException);
      await expect(service.createBulk(productsData, 2)).rejects.toMatchObject({
        response: {
          response: {
            code: 400,
            message: 'All products contain invalid data',
            status: 'failed',
          },
          errors: expect.arrayContaining([
            expect.objectContaining({ error: 'Invalid fields: convertion_rate: expected number, got string' }),
            expect.objectContaining({ error: 'Missing, empty or null fields: name' }),
          ]),
        },
      });
      expect(logsServiceMock.log).toHaveBeenCalledTimes(4);
    });
  });
});