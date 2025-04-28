import { 
  Controller, 
  Post, 
  Body, 
  BadRequestException, 
  Headers, 
  Query,  
  UnauthorizedException,
  InternalServerErrorException,
  HttpException
 } from '@nestjs/common';
import { ProductPricesService } from './price.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { ProductPriceOperationWrapperDto } from './dto/create-product-price.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CleanStringsPipe } from '../utils/clean-strings.pipe';

interface BulkCreateErrorResponse {
  response: {
    code: number;
    message: string;
    status: string;
  };
  errors: Array<{
    price?: any;
    error: string;
    index: number;
  }>;
}

@ApiTags('product-prices')
@Controller('product-prices')
export class ProductPricesController {
  private readonly authUser: string;
  private readonly authPasswordHash: string;

  constructor(
    private readonly productPricesService: ProductPricesService,
    private readonly errorNotificationService: ErrorNotificationService,
    private readonly configService: ConfigService,
  ) {
    const user = this.configService.get<string>('AUTH_USER');
    const passwordHash = this.configService.get<string>('AUTH_PASSWORD_HASH');

    if (!user || !passwordHash) {
      throw new Error('Missing required authentication environment variables');
    }

    this.authUser = user;
    this.authPasswordHash = passwordHash;
  }

  private async verifyCredentials(username: string, password: string): Promise<boolean> {
    const isPasswordValid = await bcrypt.compare(password, this.authPasswordHash);
    return username === this.authUser && isPasswordValid;
  }

  @Post()
  @ApiOperation({ summary: 'Process product prices (create, update, or delete based on existence and is_active)' })
  @ApiBody({ type: ProductPriceOperationWrapperDto })
  @ApiResponse({
    status: 200,
    description: 'Product prices processed successfully.',
    schema: {
      example: {
        response: {
          code: 200,
          message: "Transaction Successful",
          status: "successful",
        },
        errors: [],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Catalog or product price not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async processProductPrices(
    @Body(CleanStringsPipe) wrapperDto: ProductPriceOperationWrapperDto,
      @Query('batchSize') batchSize = 100,
      @Headers('username') username: string,
      @Headers('password') password: string,
    ){
      const { product_prices } = wrapperDto;

    if (!product_prices || !Array.isArray(product_prices) || product_prices.length === 0) {
      throw new BadRequestException('No product prices provided');
    }
    if (!username || !password) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    const validCredentials = await this.verifyCredentials(username, password);
    if (!validCredentials) {
      throw new UnauthorizedException('Invalid credentials');
    }

    try {
      const result = await this.productPricesService.createBulk(product_prices, Number(batchSize));

      if (result.errors.length > 0) {
        const errorDetails = result.errors
          .map(err => {
            if (err.price) {
              return `Price for product_id "${err.price.product_id || 'unknown'}": ${err.error}`;
            }
            return `Unknown error: ${err.error}`;
          })
          .join('\n');

        try {
          await this.errorNotificationService.sendErrorEmail(
            `Errors processing product prices:\n${errorDetails}`,
          );
        } catch (emailError) {
          console.error('Failed to send error notification email:', emailError.message);
        }
      }

      return {
        response: {
          code: result.response.code,
          message: result.response.message,
          status: result.response.status,
        },
        errors: result.errors,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as BulkCreateErrorResponse;

        if (response.errors && response.errors.length > 0) {
          const errorDetails = response.errors
            .map(err => {
              if (err.price) {
                return `Price for product_id "${err.price.product_id || 'unknown'}": ${err.error}`;
              }
              return `Unknown error: ${err.error}`;
            })
            .join('\n');

          try {
            await this.errorNotificationService.sendErrorEmail(
              `Errors processing product prices:\n${errorDetails}`,
            );
          } catch (emailError) {
            console.error('Failed to send error notification email:', emailError.message);
          }
        }

        throw new HttpException(
          {
            response: {
              code: response.response.code,
              message: response.response.message,
              status: response.response.status,
            },
            errors: response.errors,
          },
          response.response.code,
        );
      }

      try {
        await this.errorNotificationService.sendErrorEmail(
          `Critical error in processProductPrices: ${error.message}`,
        );
      } catch (emailError) {
        console.error('Failed to send critical error notification email:', emailError.message);
      }

      throw new InternalServerErrorException('Error processing product prices');
    }
  }
}