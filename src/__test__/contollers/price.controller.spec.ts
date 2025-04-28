import { Test, TestingModule } from '@nestjs/testing';
import { ProductPricesController } from '../../price/price.controller';
import { ProductPricesService } from '../../price/price.service';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';

const validProductPrice = {
  business_unit: 'BU1',
  catalog: 'CAT1',
  product_id: 'PROD1',
  price: 100,
  vlr_impu_consumo: 0,
  is_active: 1,
  valid_from: '2025-01-01',
};

describe('ProductPricesController', () => {
  let controller: ProductPricesController;
  let mockProductPricesService: jest.Mocked<ProductPricesService>;
  let mockErrorNotificationService: jest.Mocked<ErrorNotificationService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Mock ProductPricesService
    mockProductPricesService = {
      createBulk: jest.fn(),
    } as any;

    // Mock ErrorNotificationService
    mockErrorNotificationService = {
      sendErrorEmail: jest.fn(),
    } as any;

    // Mock ConfigService with valid credentials
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_USER') return 'testuser';
        if (key === 'AUTH_PASSWORD_HASH') return bcrypt.hashSync('testpassword', 10);
        return null;
      }),
    } as any;

    // Set up the testing module
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductPricesController],
      providers: [
        { provide: ProductPricesService, useValue: mockProductPricesService },
        { provide: ErrorNotificationService, useValue: mockErrorNotificationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ProductPricesController>(ProductPricesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processProductPrices', () => {
    it('should throw BadRequestException if no product_prices provided', async () => {
      await expect(
        controller.processProductPrices({ product_prices: [] }, 100, 'testuser', 'testpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if username or password is missing', async () => {
      await expect(
        controller.processProductPrices({ product_prices: [validProductPrice] }, 100, '', 'testpassword'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.processProductPrices({ product_prices: [validProductPrice] }, 100, 'testuser', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      await expect(
        controller.processProductPrices(
          { product_prices: [validProductPrice] },
          100,
          'wronguser',
          'wrongpassword',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return success response if product prices processed successfully', async () => {
      const mockResult = {
        response: {
          code: 200,
          message: 'Transaction Successful',
          status: 'successful',
        },
        errors: [],
      };

      mockProductPricesService.createBulk.mockResolvedValue(mockResult);

      const result = await controller.processProductPrices(
        { product_prices: [validProductPrice] },
        100,
        'testuser',
        'testpassword',
      );

      expect(result.response.code).toBe(200);
      expect(result.errors.length).toBe(0);
      expect(mockProductPricesService.createBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining(validProductPrice),
        ]),
        100,
      );
    });

    it('should call sendErrorEmail if there are errors in processing', async () => {
      const mockResult = {
        response: {
          code: 200,
          message: 'Partial Success',
          status: 'partial_success',
        },
        errors: [{ error: 'Some error', index: 0 }],
      };

      mockProductPricesService.createBulk.mockResolvedValue(mockResult);

      const result = await controller.processProductPrices(
        { product_prices: [validProductPrice] },
        100,
        'testuser',
        'testpassword',
      );

      expect(result.response.code).toBe(200);
      expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining('Errors processing product prices'),
      );
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockProductPricesService.createBulk.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        controller.processProductPrices(
          { product_prices: [validProductPrice] },
          100,
          'testuser',
          'testpassword',
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining('Critical error in processProductPrices'),
      );
    });
  });
});