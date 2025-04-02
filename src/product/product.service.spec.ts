import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductLogsService } from './productLogs.service';
import { NotFoundException } from '@nestjs/common';
import { Like } from 'typeorm';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: any;
  let productLogsService: any;

  beforeEach(async () => {
    // Mock for the repository
    productRepository = {
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      // Simulate transaction usage by directly invoking the callback function
      manager: {
        transaction: jest.fn(async (cb: (repo: any) => Promise<void>) => {
          await cb(productRepository);
        }),
      },
    };

    // Mock for the logs service
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

  describe('findAll', () => {
    it('should return products and total count', async () => {
      const fakeProducts = [{ id: 1, reference: 'ref1', name: 'Test Product' }];
      const total = 1;
      productRepository.findAndCount.mockResolvedValue([fakeProducts, total]);

      const result = await service.findAll(1, 10);
      expect(result).toEqual({ data: fakeProducts, total });
      expect(productRepository.findAndCount).toHaveBeenCalledWith({ skip: 0, take: 10 });
    });
  });

  describe('searchByKeyword', () => {
    it('should return products filtered by keyword', async () => {
      const keyword = 'test';
      const fakeProducts = [{ id: 1, reference: 'ref1', name: 'Test Product' }];
      productRepository.find.mockResolvedValue(fakeProducts);

      const result = await service.searchByKeyword(keyword);
      expect(result).toEqual(fakeProducts);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: [{ name: Like(`%${keyword}%`) }],
      });
    });
  });

  describe('findOne', () => {
    it('should return a product if it exists', async () => {
      const reference = 'ref1';
      const fakeProduct = { id: 1, reference, name: 'Test Product' };
      productRepository.findOne.mockResolvedValue(fakeProduct);

      const result = await service.findOne(reference);
      expect(result).toEqual(fakeProduct);
      expect(productRepository.findOne).toHaveBeenCalledWith({ where: { reference } });
    });

    it('should throw NotFoundException if product is not found', async () => {
      const reference = 'non-existent-ref';
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(reference)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBulk', () => {
    it('should throw error if no products are provided', async () => {
      await expect(service.createBulk([])).rejects.toThrow('No products provided for bulk creation');
    });

    it('should create products in bulk and log the actions', async () => {
      const productsData = [
        { reference: 'ref1', name: 'Product 1' },
        { reference: 'ref2', name: 'Product 2' },
      ];

      // Simulate create returning the data unchanged
      productRepository.create.mockImplementation((data) => data);
      // Simulate save returning the product with an assigned id
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );

      const result = await service.createBulk(productsData, 1);

      expect(result.count).toBe(2);
      expect(result.products.length).toBe(2);
      expect(result.errors.length).toBe(0);
      // Two logs should be created (one for each product)
      expect(productLogsService.createLog).toHaveBeenCalledTimes(2);
    });

    it('should capture errors for invalid products', async () => {
      const productsData = [
        { reference: 'ref1', name: 'Product 1' },
        { reference: 'ref1', name: 'Duplicate Product' }, // duplicate reference
        { reference: 'ref3' }, // missing name field
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );

      const result = await service.createBulk(productsData, 2);

      // Only the first product should be created
      expect(result.count).toBe(1);
      expect(result.products.length).toBe(1);
      // Expect 2 errors: one for duplicate and one for missing fields
      expect(result.errors.length).toBe(2);
    });
  });

  describe('update', () => {
    it('should update a product and log the update action', async () => {
      const reference = 'ref1';
      const oldProduct = { id: 1, reference, name: 'Old Name' };
      const updateData = { name: 'New Name' };

      productRepository.findOne.mockResolvedValue(oldProduct);
      productRepository.save.mockResolvedValue({ ...oldProduct, ...updateData });

      const result = await service.update(reference, updateData);

      expect(result.name).toBe('New Name');
      expect(productLogsService.createLog).toHaveBeenCalledWith(
        reference,
        'UPDATE',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('remove', () => {
    it('should remove a product and log the delete action', async () => {
      const reference = 'ref1';
      const fakeProduct = { id: 1, reference, name: 'Test Product' };

      productRepository.findOne.mockResolvedValue(fakeProduct);
      productRepository.remove.mockResolvedValue(fakeProduct);

      await service.remove(reference);

      expect(productRepository.findOne).toHaveBeenCalledWith({ where: { reference } });
      expect(productRepository.remove).toHaveBeenCalledWith(fakeProduct);
      expect(productLogsService.createLog).toHaveBeenCalledWith(
        reference,
        'DELETE',
        expect.any(Object),
        null
      );
    });
  });
});