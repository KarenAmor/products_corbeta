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
    // Se crea el mock del repositorio
    productRepository = {
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      // Se simula el uso de una transacción, invocando directamente la función callback
      manager: {
        transaction: jest.fn(async (cb: (repo: any) => Promise<void>) => {
          await cb(productRepository);
        }),
      },
    };

    // Se crea el mock del servicio de logs
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
    it('debe retornar los productos y el total', async () => {
      const fakeProducts = [{ id: 1, reference: 'ref1', name: 'Producto de prueba' }];
      const total = 1;
      productRepository.findAndCount.mockResolvedValue([fakeProducts, total]);

      const result = await service.findAll(1, 10);
      expect(result).toEqual({ data: fakeProducts, total });
      expect(productRepository.findAndCount).toHaveBeenCalledWith({ skip: 0, take: 10 });
    });
  });

  describe('searchByKeyword', () => {
    it('debe retornar los productos filtrados por keyword', async () => {
      const keyword = 'prueba';
      const fakeProducts = [{ id: 1, reference: 'ref1', name: 'Producto de prueba' }];
      productRepository.find.mockResolvedValue(fakeProducts);
  
      const result = await service.searchByKeyword(keyword);
      expect(result).toEqual(fakeProducts);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: [{ name: Like(`%${keyword}%`) }],
      });
    });
  });

  describe('findOne', () => {
    it('debe retornar un producto si existe', async () => {
      const reference = 'ref1';
      const fakeProduct = { id: 1, reference, name: 'Producto de prueba' };
      productRepository.findOne.mockResolvedValue(fakeProduct);

      const result = await service.findOne(reference);
      expect(result).toEqual(fakeProduct);
      expect(productRepository.findOne).toHaveBeenCalledWith({ where: { reference } });
    });

    it('debe lanzar NotFoundException si el producto no se encuentra', async () => {
      const reference = 'ref-noexiste';
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(reference)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBulk', () => {
    it('debe lanzar error si no se proveen productos', async () => {
      await expect(service.createBulk([])).rejects.toThrow('No products provided for bulk creation');
    });

    it('debe crear productos en bulk y registrar logs', async () => {
      const productsData = [
        { reference: 'ref1', name: 'Producto 1' },
        { reference: 'ref2', name: 'Producto 2' },
      ];

      // Simulamos que create devuelve el objeto sin modificaciones
      productRepository.create.mockImplementation((data) => data);
      // Simulamos que save devuelve el producto con un id asignado
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );

      const result = await service.createBulk(productsData, 1);

      expect(result.count).toBe(2);
      expect(result.products.length).toBe(2);
      expect(result.errors.length).toBe(0);
      // Se deben llamar dos logs (uno por cada producto)
      expect(productLogsService.createLog).toHaveBeenCalledTimes(2);
    });

    it('debe capturar errores en productos inválidos', async () => {
      const productsData = [
        { reference: 'ref1', name: 'Producto 1' },
        { reference: 'ref1', name: 'Producto duplicado' }, // referencia duplicada
        { reference: 'ref3' }, // falta el campo name
      ];

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: Math.floor(Math.random() * 1000), ...data })
      );

      const result = await service.createBulk(productsData, 2);

      // Solo se debería crear el primer producto
      expect(result.count).toBe(1);
      expect(result.products.length).toBe(1);
      // Se esperan 2 errores: uno por duplicidad y otro por campos requeridos
      expect(result.errors.length).toBe(2);
    });
  });

  describe('update', () => {
    it('debe actualizar un producto y registrar el log de actualización', async () => {
      const reference = 'ref1';
      const oldProduct = { id: 1, reference, name: 'Nombre Antiguo' };
      const updateData = { name: 'Nombre Nuevo' };

      productRepository.findOne.mockResolvedValue(oldProduct);
      productRepository.save.mockResolvedValue({ ...oldProduct, ...updateData });

      const result = await service.update(reference, updateData);

      expect(result.name).toBe('Nombre Nuevo');
      expect(productLogsService.createLog).toHaveBeenCalledWith(
        reference,
        'UPDATE',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('remove', () => {
    it('debe eliminar un producto y registrar el log de eliminación', async () => {
      const reference = 'ref1';
      const fakeProduct = { id: 1, reference, name: 'Producto de prueba' };

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