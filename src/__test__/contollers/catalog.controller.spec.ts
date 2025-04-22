import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from '../../catalog/catalog.controller';
import { CatalogService } from '../../catalog/catalog.service';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateCatalogsWrapperDto, CreateCatalogDto } from '../../catalog/dto/create-catalog.dto';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';

describe('CatalogController', () => {
  let controller: CatalogController;
  let mockCatalogService: jest.Mocked<CatalogService>;
  let mockErrorNotificationService: jest.Mocked<ErrorNotificationService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  /** Configuración inicial antes de cada prueba */
  beforeEach(async () => {
    // Mock del CatalogService
    mockCatalogService = {
      createBulk: jest.fn(),
    } as any;

    // Mock del ErrorNotificationService
    mockErrorNotificationService = {
      sendErrorEmail: jest.fn(),
    } as any;

    // Mock del ConfigService con credenciales simuladas
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'admin';
        if (key === 'AUTH_PASSWORD_HASH') return bcrypt.hashSync('secret', 10);
      }),
    } as any;

    // Configuración del módulo de pruebas
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: ErrorNotificationService, useValue: mockErrorNotificationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  /** Prueba 1: Resultado parcial con errores y envío de correo */
  it('should return result and send error email if errors are present', async () => {
    // Datos de entrada simulados
    const dto: CreateCatalogsWrapperDto = {
      catalogs: [
        {
          name_catalog: 'Test Catalog',
          business_unit: 'CMBOG',
          is_active: 1,
        } as CreateCatalogDto,
      ],
    };

    // Resultado simulado del servicio
    const mockResult = {
      response: {
        code: 201,
        message: 'Catalogs processed',
        status: 'partial',
      },
      errors: [
        {
          catalog: dto.catalogs[0],
          error: 'Invalid field',
          index: 0,
        },
      ],
    };

    mockCatalogService.createBulk.mockResolvedValue(mockResult);

    // Ejecución del método
    const result = await controller.createBulk(dto, 100, 'admin', 'secret');

    // Verificaciones
    expect(result.response.code).toBe(201);
    expect(mockCatalogService.createBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name_catalog: 'Test Catalog',
          business_unit: 'CMBOG',
          is_active: 1,
        }),
      ]),
      100
    );
    expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
      expect.stringContaining('Errors creating catalogs in bulk')
    );
  });

  /** Prueba 2: Lanzar UnauthorizedException con credenciales inválidas */
  it('should throw UnauthorizedException if credentials are invalid', async () => {
    const dto: CreateCatalogsWrapperDto = {
      catalogs: [],
    };

    // Verificación de excepción
    await expect(
      controller.createBulk(dto, 100, 'wrongUser', 'wrongPassword')
    ).rejects.toThrow(UnauthorizedException);
    expect(mockCatalogService.createBulk).not.toHaveBeenCalled();
  });

  /** Prueba 3: Manejo de errores inesperados */
  it('should throw InternalServerErrorException on unexpected errors', async () => {
    const dto: CreateCatalogsWrapperDto = {
      catalogs: [],
    };

    // Simulación de un error inesperado
    mockCatalogService.createBulk.mockRejectedValue(new Error('Unexpected error'));

    // Verificación de excepción y envío de correo
    await expect(controller.createBulk(dto, 100, 'admin', 'secret')).rejects.toThrow(
      InternalServerErrorException
    );
    expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
      expect.stringContaining('Critical error in createBulk')
    );
  });
});