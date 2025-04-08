import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product-dto';
import * as bcrypt from 'bcrypt';

describe('ProductController', () => {
  let controller: ProductController;
  let productServiceMock: jest.Mocked<ProductService>;
  let errorNotificationServiceMock: jest.Mocked<ErrorNotificationService>;
  let configServiceMock: Partial<ConfigService>;

  beforeEach(async () => {
    const validHash = await bcrypt.hash('testPass', 10);

    productServiceMock = {
      createBulk: jest.fn(),
    } as any;

    errorNotificationServiceMock = {
      sendErrorEmail: jest.fn().mockResolvedValue(undefined),
    } as any;

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'testUser';
        if (key === 'AUTH_PASSWORD_HASH') return validHash;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: productServiceMock },
        { provide: ErrorNotificationService, useValue: errorNotificationServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
  });

  describe('constructor', () => {
    it('should throw error if AUTH_USER is missing', async () => {
      configServiceMock.get = jest.fn((key: string) => {
        if (key === 'AUTH_USER') return undefined;
        if (key === 'AUTH_PASSWORD_HASH') return '$2b$10$somehash';
        return undefined;
      });

      expect(() => new ProductController(productServiceMock, errorNotificationServiceMock, configServiceMock as ConfigService))
        .toThrow('Missing required authentication environment variables');
    });

    it('should throw error if AUTH_PASSWORD_HASH is missing', async () => {
      configServiceMock.get = jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'testUser';
        if (key === 'AUTH_PASSWORD_HASH') return undefined;
        return undefined;
      });

      expect(() => new ProductController(productServiceMock, errorNotificationServiceMock, configServiceMock as ConfigService))
        .toThrow('Missing required authentication environment variables');
    });
  });

  describe('createBulk', () => {
    const validCredentials = {
      'x-auth-username': 'testUser',
      'x-auth-password': 'testPass',
    };

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

    it('should throw UnauthorizedException if headers are missing', async () => {
      await expect(
        controller.createBulk(productDto, 100, '', '')
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.createBulk(productDto, 100, 'testUser', '')
      ).rejects.toThrow(new UnauthorizedException('Missing authentication headers'));
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      await expect(
        controller.createBulk(productDto, 100, 'wrongUser', 'wrongPass')
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('should create products successfully and return result', async () => {
      const serviceResponse = {
        response: {
          code: 200,
          message: 'Transacción Exitosa',
          status: 'Exitoso',
        },
        errors: [],
      };
      productServiceMock.createBulk.mockResolvedValue(serviceResponse);

      const result = await controller.createBulk(productDto, 100, validCredentials['x-auth-username'], validCredentials['x-auth-password']);

      expect(productServiceMock.createBulk).toHaveBeenCalledWith(
        [{ ...productDto[0], is_active: 1 }],
        100
      );
      expect(result).toEqual({
        respuesta: {
          codigoMensaje: serviceResponse.response.code,
          mensaje: serviceResponse.response.message,
          estadoMensaje: serviceResponse.response.status,
        },
        errores: serviceResponse.errors,
      });
      expect(errorNotificationServiceMock.sendErrorEmail).not.toHaveBeenCalled();
    });

    it('should handle errors and send email notification', async () => {
      const serviceResponse = {
        response: {
          code: 200,
          message: 'Transacción Exitosa',
          status: 'Fallido',
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

      const result = await controller.createBulk(productDto, 100, validCredentials['x-auth-username'], validCredentials['x-auth-password']);

      expect(productServiceMock.createBulk).toHaveBeenCalled();
      expect(errorNotificationServiceMock.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining('Product with reference "ref1": Missing required fields: name')
      );
      expect(result).toEqual({
        respuesta: {
          codigoMensaje: serviceResponse.response.code,
          mensaje: serviceResponse.response.message,
          estadoMensaje: serviceResponse.response.status,
        },
        errores: serviceResponse.errors,
      });
    });

    it('should throw InternalServerErrorException on critical error and send email', async () => {
      const error = new Error('Database failure');
      productServiceMock.createBulk.mockRejectedValue(error);

      await expect(
        controller.createBulk(productDto, 100, validCredentials['x-auth-username'], validCredentials['x-auth-password'])
      ).rejects.toThrow(new InternalServerErrorException('Error creating products in bulk'));

      expect(errorNotificationServiceMock.sendErrorEmail).toHaveBeenCalledWith(
        `Critical error in createBulk: ${error.message}`
      );
    });
  });
});