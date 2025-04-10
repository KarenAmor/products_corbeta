import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product-dto';
import * as bcrypt from 'bcrypt';
// Importa herramientas de prueba de NestJS, el controlador a probar, sus dependencias, excepciones, el DTO y bcrypt para manejar contraseñas.

describe('ProductController', () => {
  // Define un conjunto de pruebas para el ProductController.

  let controller: ProductController;
  let productServiceMock: jest.Mocked<ProductService>;
  let errorNotificationServiceMock: jest.Mocked<ErrorNotificationService>;
  let configServiceMock: Partial<ConfigService>;
  // Declara variables para el controlador, y mocks para el servicio de productos, el servicio de notificación de errores y el servicio de configuración.

  beforeEach(async () => {
    // Configura el entorno antes de cada prueba.

    const validHash = await bcrypt.hash('testPass', 10);
    // Genera un hash válido para la contraseña "testPass" usando bcrypt.

    productServiceMock = {
      createBulk: jest.fn(),
    } as any;
    // Crea un mock del ProductService con una función simulada createBulk.

    errorNotificationServiceMock = {
      sendErrorEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    // Crea un mock del ErrorNotificationService con una función simulada sendErrorEmail que resuelve undefined.

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'testUser';
        if (key === 'AUTH_PASSWORD_HASH') return validHash;
        return undefined;
      }),
    };
    // Crea un mock del ConfigService que devuelve 'testUser' y el hash válido para las claves esperadas.

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: productServiceMock },
        { provide: ErrorNotificationService, useValue: errorNotificationServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();
    // Crea un módulo de prueba con el ProductController y las dependencias simuladas.

    controller = module.get<ProductController>(ProductController);
    // Obtiene una instancia del ProductController para usar en las pruebas.
  });

  describe('constructor', () => {
    // Define pruebas para el constructor del controlador.

    it('should throw error if AUTH_USER is missing', async () => {
      // Prueba que verifica si se lanza un error cuando falta AUTH_USER.
      configServiceMock.get = jest.fn((key: string) => {
        if (key === 'AUTH_USER') return undefined;
        if (key === 'AUTH_PASSWORD_HASH') return '$2b$10$somehash';
        return undefined;
      });
      // Simula que AUTH_USER no está definido.

      expect(() => new ProductController(productServiceMock, errorNotificationServiceMock, configServiceMock as ConfigService))
        .toThrow('Missing required authentication environment variables');
      // Verifica que el constructor lance el error esperado.
    });

    it('should throw error if AUTH_PASSWORD_HASH is missing', async () => {
      // Prueba que verifica si se lanza un error cuando falta AUTH_PASSWORD_HASH.
      configServiceMock.get = jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'testUser';
        if (key === 'AUTH_PASSWORD_HASH') return undefined;
        return undefined;
      });
      // Simula que AUTH_PASSWORD_HASH no está definido.

      expect(() => new ProductController(productServiceMock, errorNotificationServiceMock, configServiceMock as ConfigService))
        .toThrow('Missing required authentication environment variables');
      // Verifica que el constructor lance el error esperado.
    });
  });

  describe('createBulk', () => {
    // Define pruebas para el método createBulk.

    const validCredentials = {
      'username': 'testUser',
      'password': 'testPass',
    };
    // Define credenciales válidas para usar en las pruebas.

    const productDto: CreateProductDto[] = [
      {
        reference: 'ref1',
        name: 'Product 1',
        packing: 'UNI',
        convertion_rate: 1,
        vat_group: 'Group A',
        vat: 0.1,
        packing_to: 'CAJ',
        is_active: true,
      },
    ];
    // Define un DTO de producto válido para las pruebas.

    it('should throw UnauthorizedException if headers are missing', async () => {
      // Prueba que verifica si se lanza un error cuando faltan las cabeceras de autenticación.
      await expect(
        controller.createBulk(productDto, 100, '', '')
      ).rejects.toThrow(UnauthorizedException);
      // Verifica que se lance UnauthorizedException cuando ambas cabeceras están vacías.

      await expect(
        controller.createBulk(productDto, 100, 'testUser', '')
      ).rejects.toThrow(new UnauthorizedException('Missing authentication headers'));
      // Verifica el mensaje específico cuando falta la contraseña.
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      // Prueba que verifica si se lanza un error con credenciales inválidas.
      await expect(
        controller.createBulk(productDto, 100, 'wrongUser', 'wrongPass')
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      // Verifica que se lance UnauthorizedException con credenciales incorrectas.
    });

    it('should create products successfully and return result', async () => {
      // Prueba que verifica la creación exitosa de productos.
      const serviceResponse = {
        response: {
          code: 200,
          message: 'Transaction Successful',
          status: 'Failed',
        },
        errors: [],
      };
      productServiceMock.createBulk.mockResolvedValue(serviceResponse);
      // Simula una respuesta exitosa del ProductService.

      const result = await controller.createBulk(productDto, 100, validCredentials['username'], validCredentials['password']);
      // Ejecuta createBulk con credenciales válidas.

      expect(productServiceMock.createBulk).toHaveBeenCalledWith(
        [{ ...productDto[0], is_active: 1 }],
        100
      );
      // Verifica que createBulk del servicio fue llamado con los datos transformados (is_active como 1).

      expect(result).toEqual({
        respuesta: {
          codigoMensaje: serviceResponse.response.code,
          mensaje: serviceResponse.response.message,
          estadoMensaje: serviceResponse.response.status,
        },
        errores: serviceResponse.errors,
      });
      // Verifica que el resultado devuelto coincida con la estructura esperada.

      expect(errorNotificationServiceMock.sendErrorEmail).not.toHaveBeenCalled();
      // Verifica que no se envió un correo de error porque no hubo errores.
    });

    it('should handle errors and send email notification', async () => {
      // Prueba que verifica el manejo de errores y el envío de notificaciones.
      const serviceResponse = {
        response: {
          code: 200,
          message: 'Transaction Successful',
          status: 'Failed',
        },
        errors: [
          {
            product: { reference: 'ref1' },
            error: 'Missing required fields: name',
            index: 0,
          },
        ],
      };
      productServiceMock.createBulk.mockResolvedValue(serviceResponse);
      // Simula una respuesta con errores del ProductService.

      const result = await controller.createBulk(productDto, 100, validCredentials['username'], validCredentials['password']);
      // Ejecuta createBulk con credenciales válidas.

      expect(productServiceMock.createBulk).toHaveBeenCalled();
      // Verifica que el servicio fue llamado.

      expect(errorNotificationServiceMock.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining('Product with reference "ref1": Missing required fields: name')
      );
      // Verifica que se envió un correo con los detalles del error.

      expect(result).toEqual({
        respuesta: {
          codigoMensaje: serviceResponse.response.code,
          mensaje: serviceResponse.response.message,
          estadoMensaje: serviceResponse.response.status,
        },
        errores: serviceResponse.errors,
      });
      // Verifica que el resultado devuelto incluya los errores.
    });

    it('should throw InternalServerErrorException on critical error and send email', async () => {
      // Prueba que verifica el manejo de un error crítico.
      const error = new Error('Database failure');
      productServiceMock.createBulk.mockRejectedValue(error);
      // Simula un fallo crítico en el ProductService.

      await expect(
        controller.createBulk(productDto, 100, validCredentials['username'], validCredentials['password'])
      ).rejects.toThrow(new InternalServerErrorException('Error creating products in bulk'));
      // Verifica que se lance InternalServerErrorException.

      expect(errorNotificationServiceMock.sendErrorEmail).toHaveBeenCalledWith(
        `Critical error in createBulk: ${error.message}`
      );
      // Verifica que se envió un correo con el mensaje del error crítico.
    });
  });
});