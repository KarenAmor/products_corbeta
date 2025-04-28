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
import { ProductStocksService } from './product-stocks.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { ProductStockOperationWrapperDto } from './dto/create-product-stock.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CleanStringsPipe } from '../utils/clean-strings.pipe';

// Definición de la estructura para respuestas de error en caso de errores en el procesamiento masivo
interface BulkCreateErrorResponse {
  response: {
    code: number;
    message: string;
    status: string;
  };
  errors: Array<{
    stock?: any;
    error: string;
    index: number;
  }>;
}

@ApiTags('product-stocks')
@Controller('product-stocks')
export class ProductStocksController {
  private readonly authUser: string;
  private readonly authPasswordHash: string;

  constructor(
    private readonly productStocksService: ProductStocksService,
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
  @ApiOperation({ summary: 'Process product stocks (create, update, or delete based on existence and is_active)' })
  @ApiBody({ type: ProductStockOperationWrapperDto })
  @ApiResponse({
    status: 200,
    description: 'Product stocks processed successfully.',
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
  @ApiResponse({ status: 404, description: 'Catalog or product stock not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async processProductStocks(
    @Body(CleanStringsPipe) wrapperDto: ProductStockOperationWrapperDto,
    @Query('batchSize') batchSize = 100,
    @Headers('username') username: string,
    @Headers('password') password: string,
  ) {
    const { product_stock } = wrapperDto;
  
    if (!product_stock || !Array.isArray(product_stock) || product_stock.length === 0) {
      throw new BadRequestException('No product stocks provided');
    }
    if (!username || !password) {
      throw new UnauthorizedException('Missing authentication headers');
    }
  
    const validCredentials = await this.verifyCredentials(username, password);
    if (!validCredentials) {
      throw new UnauthorizedException('Invalid credentials');
    }
  
    try {
      const result = await this.productStocksService.createBulk(product_stock, Number(batchSize));
  
      if (result.errors.length > 0) {
        const errorDetails = result.errors
          .map(err => {
            if (err.stock) {
              return `Stock for product_id "${err.stock.product_id || 'unknown'}": ${err.error}`;
            }
            return `Unknown error: ${err.error}`;
          })
          .join('\n');
  
        try {
          await this.errorNotificationService.sendErrorEmail(
            `Errors processing product stocks:\n${errorDetails}`,
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
              if (err.stock) {
                return `Stock for product_id "${err.stock.product_id || 'unknown'}": ${err.error}`;
              }
              return `Unknown error: ${err.error}`;
            })
            .join('\n');
  
          try {
            await this.errorNotificationService.sendErrorEmail(
              `Errors processing product stocks:\n${errorDetails}`,
            );
          } catch (emailError) {
            console.error('Failed to send critical error notification email:', emailError.message);
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
          `Critical error in processProductStocks: ${error.message}`,
        );
      } catch (emailError) {
        console.error('Failed to send critical error notification email:', emailError.message);
      }
  
      throw new InternalServerErrorException('Error processing product stocks');
    }
  }
}  