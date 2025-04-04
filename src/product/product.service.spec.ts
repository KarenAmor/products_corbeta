import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: any;

  beforeEach(async () => {
    // Mock repository
    productRepository = {
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      manager: {
        transaction: jest.fn(async (cb: (repo: any) => Promise<void>) => {
          await cb(productRepository);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useValue: productRepository },
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

    it('should create products in bulk without logging', async () => {
      const productsData: Partial<Product>[] = [
        { reference: 'ref1', name: 'Product 1', tipoEvento: 'CREATE' },
        { reference: 'ref2', name: 'Product 2', tipoEvento: 'UPDATE' },
        { reference: 'ref3', name: 'Product 3', tipoEvento: 'UPDATE' },
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 1);

      expect(result.count).toBe(3);
      expect(result.products.length).toBe(3);
      expect(result.errors.length).toBe(0);
      // Removed log verification
    });

    it('should capture errors for invalid products', async () => {
      const productsData: Partial<Product>[] = [
        { reference: 'ref1', name: 'Product 1', tipoEvento: 'CREATE' },          // valid
        { reference: 'ref1', name: 'Duplicate Product', tipoEvento: 'CREATE' }, // duplicate
        { reference: 'ref3', tipoEvento: 'CREATE' },                             // missing name
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data }),
      );
      productRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createBulk(productsData, 2);

      expect(result.count).toBe(1);
      expect(result.products.length).toBe(1);
      expect(result.errors.length).toBe(2);
    });
  });
});