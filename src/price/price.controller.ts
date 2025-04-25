import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ProductPricesService } from './price.service';
import { ProductPrice } from './entities/product-price.entity';
import { ProductPriceOperationWrapperDto } from './dto/create-product-price.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('product-prices')
@Controller('product-prices')
export class ProductPricesController {
  constructor(private readonly productPricesService: ProductPricesService) {}

  @Post()
  @ApiOperation({ summary: 'Process product prices (create, update, or delete based on existence and is_active)' })
  @ApiBody({ type: ProductPriceOperationWrapperDto })
  @ApiResponse({
    status: 201,
    description:
      'The product prices have been successfully processed. Creates a new record if it does not exist; updates if it exists and is_active=1; deletes if is_active=0 and DELETE_RECORD=true; updates if is_active=0 and DELETE_RECORD=false. Returns an array where each element is a ProductPrice or null (for deleted records).',
    type: [ProductPrice],
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Catalog or product price not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async processProductPrices(@Body() wrapperDto: ProductPriceOperationWrapperDto): Promise<(ProductPrice | null)[]> {
    const { product_prices } = wrapperDto;
    const results: (ProductPrice | null)[] = [];

    for (const operation of product_prices) {
      try {
        const result = await this.productPricesService.processOperation(operation);
        results.push(result);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
    }

    return results;
  }
}