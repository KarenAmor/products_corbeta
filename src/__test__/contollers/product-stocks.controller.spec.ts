import { Test, TestingModule } from '@nestjs/testing';
import { ProductStocksController } from '../../product_stock/product-stocks.controller';
import { ProductStocksService } from '../../product_stock/product-stocks.service';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BadRequestException, UnauthorizedException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { ProductStockOperationWrapperDto } from '../../product_stock/dto/create-product-stock.dto';

const validProductStock = {
  business_unit: 'BU1',
  catalog: 'CAT1',
  product_id: 'PROD1',
  stock: 50,
  is_active: 1,
  valid_from: '2025-01-01',
};

describe('ProductStocksController', () => {
  let controller: ProductStocksController;
  let mockProductStocksService: jest.Mocked<ProductStocksService>;
  let mockErrorNotificationService: jest.Mocked<ErrorNotificationService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Mock ProductStocksService
    mockProductStocksService = {
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
      controllers: [ProductStocksController],
      providers: [
        { provide: ProductStocksService, useValue: mockProductStocksService },
        { provide: ErrorNotificationService, useValue: mockErrorNotificationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ProductStocksController>(ProductStocksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processProductStocks', () => {
    it('should throw BadRequestException if no product stocks provided', async () => {
      const dto: ProductStockOperationWrapperDto = { product_stock: [] };
      await expect(
        controller.processProductStocks(dto, 100, 'testuser', 'testpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if username or password is missing', async () => {
      const dto: ProductStockOperationWrapperDto = { product_stock: [validProductStock] };

      await expect(
        controller.processProductStocks(dto, 100, '', 'testpassword'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.processProductStocks(dto, 100, 'testuser', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      const dto: ProductStockOperationWrapperDto = { product_stock: [validProductStock] };

      await expect(
        controller.processProductStocks(dto, 100, 'wronguser', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return success response if product stocks processed successfully', async () => {
      const mockResult = {
        response: {
          code: 200,
          message: 'Transaction Successful',
          status: 'successful',
        },
        errors: [],
      };

      mockProductStocksService.createBulk.mockResolvedValue(mockResult);

      const result = await controller.processProductStocks(
        { product_stock: [validProductStock] },
        100,
        'testuser',
        'testpassword',
      );

      expect(result.response.code).toBe(200);
      expect(result.errors.length).toBe(0);
      expect(mockProductStocksService.createBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining(validProductStock),
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
        errors: [
          { stock: validProductStock, error: 'Invalid stock value', index: 0 },
        ],
      };

      mockProductStocksService.createBulk.mockResolvedValue(mockResult);

      const result = await controller.processProductStocks(
        { product_stock: [validProductStock] },
        100,
        'testuser',
        'testpassword',
      );

      expect(result.response.code).toBe(200);
      expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining(`Stock for product_id "${validProductStock.product_id}": Invalid stock value`),
      );
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockProductStocksService.createBulk.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        controller.processProductStocks(
          { product_stock: [validProductStock] },
          100,
          'testuser',
          'testpassword',
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining('Critical error in processProductStocks'),
      );
    });

    it('should handle HttpException and send error email', async () => {
      const mockErrorResponse = {
        response: {
          code: 404,
          message: 'Catalog or product stock not found',
          status: 'error',
        },
        errors: [
          { stock: validProductStock, error: 'Catalog not found', index: 0 },
        ],
      };

      mockProductStocksService.createBulk.mockRejectedValue(
        new HttpException(mockErrorResponse, 404),
      );

      await expect(
        controller.processProductStocks(
          { product_stock: [validProductStock] },
          100,
          'testuser',
          'testpassword',
        ),
      ).rejects.toThrow(HttpException);

      expect(mockErrorNotificationService.sendErrorEmail).toHaveBeenCalledWith(
        expect.stringContaining(`Stock for product_id "${validProductStock.product_id}": Catalog not found`),
      );
    });
  });
});