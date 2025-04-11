import { Test, TestingModule } from '@nestjs/testing';
// Importa herramientas de NestJS para crear un módulo de pruebas.

import { ProductService } from '../../product/product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../../product/entities/product.entity';
import { LogsService } from '../../logs/logs.service';
// Importa el servicio a probar, herramientas para inyectar el repositorio y las dependencias necesarias.

describe('ProductService', () => {
  // Define un conjunto de pruebas para el ProductService.

  let service: ProductService;
  let productRepository: any;
  let logsServiceMock: any;
  // Declara variables para el servicio, el repositorio simulado y el servicio de logs simulado.

  beforeEach(async () => {
    // Configura el entorno antes de cada prueba.

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
    // Crea un mock del repositorio de productos con funciones simuladas (findOne, create, save) y una transacción simulada.

    logsServiceMock = {
      log: jest.fn(),
    };
    // Crea un mock del servicio de logs con una función simulada "log".

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: LogsService, useValue: logsServiceMock },
      ],
    }).compile();
    // Crea un módulo de prueba con el ProductService y las dependencias simuladas.

    service = module.get<ProductService>(ProductService);
    // Obtiene una instancia del ProductService para usarla en las pruebas.
  });

  describe('createBulk', () => {
    // Define un subconjunto de pruebas específicas para el método createBulk.

    it('should throw error if no products are provided', async () => {
      // Prueba que verifica si se lanza un error cuando no se proporcionan productos.
      await expect(service.createBulk([])).rejects.toThrow(
        'No products provided in the products array',
      );
      // Espera que createBulk rechace la promesa con el mensaje de error correcto.
    });

    it('should create products in bulk successfully', async () => {
      // Prueba que verifica la creación exitosa de productos en masa.
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
      // Define datos de prueba con dos productos válidos.

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);
      // Configura los mocks para simular la creación y guardado de productos, y que no existan previamente.

      const result = await service.createBulk(productsData, 1);
      // Ejecuta el método createBulk con un tamaño de lote de 1.

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('Transaction Successful');
      expect(result.response.status).toBe('successful');
      expect(result.errors.length).toBe(0);
      expect(productRepository.save).toHaveBeenCalledTimes(2);
      expect(logsServiceMock.log).toHaveBeenCalledTimes(2);
      // Verifica que el resultado sea exitoso, sin errores, y que las funciones simuladas se hayan llamado correctamente.
    });

    it('should capture errors for invalid products with partial success', async () => {
      // Prueba que verifica el manejo de errores con éxito parcial.
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
      // Define datos de prueba con un producto válido, un duplicado, uno con campo faltante y uno con tipo inválido.

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);
      // Configura los mocks para simular comportamiento normal.

      const result = await service.createBulk(productsData, 2);
      // Ejecuta el método con un tamaño de lote de 2.

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('1 of 4 products inserted successfully');
      expect(result.response.status).toBe('partial_success');
      expect(result.errors.length).toBe(3);
      expect(result.errors[0].error).toBe("Duplicate reference 'ref1' in the batch");
      expect(result.errors[1].error).toBe('Missing required fields: name');
      expect(result.errors[2].error).toContain('Invalid type for convertion_rate');
      expect(logsServiceMock.log).toHaveBeenCalledTimes(4);
      // Verifica que solo 1 producto se procesó correctamente, con 3 errores específicos, y que los logs se registraron.
    });

    it('should return failed status when all products fail', async () => {
      // Prueba que verifica el estado "fallido" cuando todos los productos tienen errores.
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
      // Define datos de prueba con un producto con tipo inválido y otro con campo faltante.

      productRepository.create.mockImplementation((data) => data);
      productRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, modified: new Date() }),
      );
      productRepository.findOne.mockResolvedValue(undefined);
      // Configura los mocks para simular comportamiento normal.

      const result = await service.createBulk(productsData, 2);
      // Ejecuta el método con un tamaño de lote de 2.

      expect(result.response.code).toBe(200);
      expect(result.response.message).toBe('0 of 2 products inserted successfully');
      expect(result.response.status).toBe('failed');
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].error).toContain('Invalid type for convertion_rate');
      expect(result.errors[1].error).toBe('Missing required fields: name');
      expect(logsServiceMock.log).toHaveBeenCalledTimes(2);
      // Verifica que ningún producto se procesó, con 2 errores específicos, y que los logs se registraron.
    });
  });
});