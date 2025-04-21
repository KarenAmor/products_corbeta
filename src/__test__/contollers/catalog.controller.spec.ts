import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from '../../catalog/catalog.controller';
import { CatalogService } from '../../catalog/catalog.service';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateCatalogsWrapperDto, CreateCatalogDto } from '../../catalog/dto/create-catalog.dto';

describe('CatalogController', () => {
  let controller: CatalogController;
  let mockCatalogService: jest.Mocked<CatalogService>;
  let mockErrorNotificationService: jest.Mocked<ErrorNotificationService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockCatalogService = {
      createBulk: jest.fn(),
    } as any;

    mockErrorNotificationService = {
      sendErrorEmail: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'admin';
        if (key === 'AUTH_PASSWORD_HASH') return bcrypt.hashSync('secret', 10);
      }),
    } as any;

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

  it('should return result and send error email if errors are present', async () => {
    const dto: CreateCatalogsWrapperDto = {
      catalogs: [
        {
          name: 'Test Catalog',
          city_id: 1,
          is_active: true,
        } as CreateCatalogDto,
      ],
    };

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

    const result = await controller.createBulk(dto, 100, 'admin', 'secret');

    expect(result.response.code).toBe(201);
    expect(mockCatalogService.createBulk).toHaveBeenCalled();
    expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
      expect.stringContaining('Errors creating catalogs in bulk')
    );
  });
});