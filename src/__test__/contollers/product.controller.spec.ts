import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from '../../product/product.controller';
import { ProductService } from '../../product/product.service';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto, CreateProductsWrapperDto } from '../../product/dto/create-product-dto';
import * as bcrypt from 'bcrypt';
import { CleanStringsPipe } from '../../utils/clean-strings.pipe';

describe('ProductController', () => {
  let controller: ProductController;
  let productServiceMock: jest.Mocked<ProductService>;
  let errorNotificationServiceMock: jest.Mocked<ErrorNotificationService>;
  let configServiceMock: Partial<ConfigService>;
  let cleanStringsPipe: CleanStringsPipe;

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

    cleanStringsPipe = new CleanStringsPipe();

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
      username: 'testUser',
      password: 'testPass',
    };

    // DTO con caracteres especiales para probar el pipe
    const productDto: CreateProductDto = {
      reference: 'ref1',
      name: 'Producto con ñ y áéí',
      packing: 'CÁJA',
      convertion_rate: 1,
      vat_group: 'Gröup A',
      vat: 0.1,
      packing_to: 'BÖLSA',
      is_active: true,
    };

    // Versión limpia del DTO después de pasar por el pipe
    const cleanedProductDto: CreateProductDto = {
      reference: 'ref1',
      name: 'Producto con n y aei',
      packing: 'CAJA',
      convertion_rate: 1,
      vat_group: 'Group A',
      vat: 0.1,
      packing_to: 'BOLSA',
      is_active: true,
    };

    // Envoltorio con el DTO original
    const wrapperDto: CreateProductsWrapperDto = {
      products: [productDto],
    };

    it('should throw UnauthorizedException if headers are missing', async () => {
      await expect(
        controller.createBulk(wrapperDto, 100, '', '')
      ).rejects.toThrow(new UnauthorizedException('Missing authentication headers'));

      await expect(
        controller.createBulk(wrapperDto, 100, 'testUser', '')
      ).rejects.toThrow(new UnauthorizedException('Missing authentication headers'));
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      await expect(
        controller.createBulk(wrapperDto, 100, 'wrongUser', 'wrongPass')
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('should create products successfully and return result', async () => {
      const serviceResponse = {
        response: {
          code: 200,
          message: 'Transaction Successful',
          status: 'successful',
        },
        errors: [],
      };
      productServiceMock.createBulk.mockResolvedValue(serviceResponse);

      // Aplicar el pipe manualmente para simular su comportamiento
      const cleanedInput = cleanStringsPipe.transform(wrapperDto);

      const result = await controller.createBulk(cleanedInput, 100, validCredentials.username, validCredentials.password);

      expect(productServiceMock.createBulk).toHaveBeenCalledWith(
        [{ ...cleanedProductDto, is_active: 1 }],
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
          message: '1 of 1 products inserted successfully',
          status: 'partial_success',
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

      // Aplicar el pipe manualmente
      const cleanedInput = cleanStringsPipe.transform(wrapperDto);

      const result = await controller.createBulk(cleanedInput, 100, validCredentials.username, validCredentials.password);

      expect(productServiceMock.createBulk).toHaveBeenCalledWith(
        [{ ...cleanedProductDto, is_active: 1 }],
        100
      );

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

      // Aplicar el pipe manualmente
      const cleanedInput = cleanStringsPipe.transform(wrapperDto);

      await expect(
        controller.createBulk(cleanedInput, 100, validCredentials.username, validCredentials.password)
      ).rejects.toThrow(new InternalServerErrorException('Error creating products in bulk'));

      expect(errorNotificationServiceMock.sendErrorEmail).toHaveBeenCalledWith(
        `Critical error in createBulk: ${error.message}`
      );
    });

    it('should clean special characters from string fields', async () => {
      const serviceResponse = {
        response: {
          code: 200,
          message: 'Transaction Successful',
          status: 'successful',
        },
        errors: [],
      };
      productServiceMock.createBulk.mockResolvedValue(serviceResponse);

      // Aplicar el pipe manualmente
      const cleanedInput = cleanStringsPipe.transform(wrapperDto);

      const result = await controller.createBulk(cleanedInput, 100, validCredentials.username, validCredentials.password);

      expect(productServiceMock.createBulk).toHaveBeenCalledWith(
        [{ ...cleanedProductDto, is_active: 1 }],
        100
      );

      expect(result).toEqual({
        response: {
          code: serviceResponse.response.code,
          menssage: serviceResponse.response.message,
          status: serviceResponse.response.status,
        },
        errores: serviceResponse.errors,
      });
    });
  });
});