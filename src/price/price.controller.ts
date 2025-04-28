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

// Definición de la estructura para respuestas de error en caso de errores en el procesamiento masivo
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

  // Constructor donde se inyectan los servicios necesarios
  constructor(
    private readonly productPricesService: ProductPricesService,
    private readonly errorNotificationService: ErrorNotificationService,
    private readonly configService: ConfigService,
  ) {
    // Se recuperan las credenciales de usuario y hash de password desde las variables de entorno
    const user = this.configService.get<string>('AUTH_USER');
    const passwordHash = this.configService.get<string>('AUTH_PASSWORD_HASH');

    // Validación inicial: Si faltan variables de entorno requeridas, se lanza un error
    if (!user || !passwordHash) {
      throw new Error('Missing required authentication environment variables');
    }

    this.authUser = user;
    this.authPasswordHash = passwordHash;
  }

  // Método privado para verificar las credenciales proporcionadas contra las almacenadas
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
  ) {
    const { product_prices } = wrapperDto;

    // Validaciones iniciales
    if (!product_prices || !Array.isArray(product_prices) || product_prices.length === 0) {
      throw new BadRequestException('No product prices provided');
    }
    if (!username || !password) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    // Validación de credenciales
    const validCredentials = await this.verifyCredentials(username, password);
    if (!validCredentials) {
      throw new UnauthorizedException('Invalid credentials');
    }

    try {
      // Llama al servicio para crear precios en lote
      const result = await this.productPricesService.createBulk(product_prices, Number(batchSize));

      // Si hay errores en la respuesta, arma un detalle de los errores y envía notificación por correo

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

      // Retorna el resultado de la operación, incluyendo cualquier error
      return {
        response: {
          code: result.response.code,
          message: result.response.message,
          status: result.response.status,
        },
        errors: result.errors,
      };
    } catch (error) {
      // Manejo de errores específicos de tipo HttpException
      if (error instanceof HttpException) {
        const response = error.getResponse() as BulkCreateErrorResponse;

        // Si la respuesta tiene errores, intenta enviar un correo notificando los mismos
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

        // Relanza la excepción con el mismo detalle de respuesta
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

      // Si es otro tipo de error, envía una notificación crítica
      try {
        await this.errorNotificationService.sendErrorEmail(
          `Critical error in processProductPrices: ${error.message}`,
        );
      } catch (emailError) {
        console.error('Failed to send critical error notification email:', emailError.message);
      }

      // Lanza una excepción general de servidor
      throw new InternalServerErrorException('Error processing product prices');
    }
  }
}