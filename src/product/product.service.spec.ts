import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductLogsService } from './productLogs.service';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: any;
  let productLogsService: any;

  beforeEach(async () => {
    // Mock para el repository
    productRepository = {
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      // Simula el uso de transacciones invocando directamente el callback
      manager: {
        transaction: jest.fn(async (cb: (repo: any) => Promise<void>) => {
          await cb(productRepository);
        }),
      },
    };

    // Mock para el servicio de logs
    productLogsService = {
      createLog: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: ProductLogsService, useValue: productLogsService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('createBulk', () => {
    it('should throw error if no products are provided', async () => {
      await expect(service.createBulk([])).rejects.toThrow('No products provided for bulk creation');
    });

    it('should create products in bulk and log the actions', async () => {
      const productsData: Partial<Product>[] = [
        { reference: 'ref1', name: 'Product 1', tipoEvento: 'CREATE' as 'CREATE' },
        { reference: 'ref2', name: 'Product 2', tipoEvento: 'UPDATE' as 'UPDATE' },
        { reference: 'ref3', name: 'Product 2', tipoEvento: 'UPDATE' as 'UPDATE' },
      ];

      // Simula que create retorna los datos sin cambios
      productRepository.create.mockImplementation((data) => data);
      // Simula que save retorna el producto con un id asignado
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );
      // Simula que findOne retorna undefined para indicar producto nuevo
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 1);

      expect(result.count).toBe(3);
      expect(result.products.length).toBe(3);
      expect(result.errors.length).toBe(0);
      // Se deben crear dos logs (uno por cada producto)
      expect(productLogsService.createLog).toHaveBeenCalledTimes(3);
    });

    it('should capture errors for invalid products', async () => {
      const productsData: Partial<Product>[] = [
        { reference: 'ref1', name: 'Product 1', tipoEvento: 'CREATE' as 'CREATE' },          // válido
        { reference: 'ref1', name: 'Producto duplicado', tipoEvento: 'CREATE' as 'CREATE' }, // duplicado
        { reference: 'ref3', tipoEvento: 'CREATE' as 'CREATE' },
      ];


      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );
      // Para la primera referencia, findOne retorna undefined (producto nuevo)
      productRepository.findOne.mockImplementation(({ where: { reference } }) =>
        Promise.resolve(reference === 'ref1' ? undefined : undefined)
      );

      const result = await service.createBulk(productsData, 2);

      // Sólo el primer producto debe crearse correctamente
      expect(result.count).toBe(1);
      expect(result.products.length).toBe(1);
      // Se esperan 2 errores: uno por referencia duplicada y otro por campo name faltante
      expect(result.errors.length).toBe(2);
    });
  });
});
