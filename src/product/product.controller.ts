import {
  Controller,
  Post,
  Body,
  Query,
  InternalServerErrorException,
  Headers,
  UnauthorizedException,
  HttpException,
  HttpCode
} from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { Product } from './entities/product.entity';
import { CreateProductsWrapperDto } from './dto/create-product-dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CleanStringsPipe } from '../utils/clean-strings.pipe';

// Interfaz para tipar la respuesta de BadRequestException
interface BulkCreateErrorResponse {
  response: {
    code: number;
    message: string;
    status: string;
  };
  errors: Array<{
    product?: any;
    error: string;
    index: number;
  }>;
}

@ApiTags('products')
@Controller('products')
export class ProductController {
  private readonly authUser: string;
  private readonly authPasswordHash: string;

  constructor(
    private readonly productService: ProductService,
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
  @HttpCode(200)
  @ApiOperation({ summary: 'Create products in bulk' })
  @ApiResponse({ status: 201, description: 'Products created successfully', type: [Product] })
  async createBulk(
    @Body(CleanStringsPipe) wrapper: CreateProductsWrapperDto,
    @Query('batchSize') batchSize = 100,
    @Headers('username') username: string,
    @Headers('password') password: string,
  ) {
    if (!username || !password) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    const validCredentials = await this.verifyCredentials(username, password);
    if (!validCredentials) {
      throw new UnauthorizedException('Invalid credentials');
    }

    try {
      const productsData = wrapper.products;
      const result = await this.productService.createBulk(productsData, Number(batchSize));

      if (result.errors.length > 0) {
        const errorDetails = result.errors
          .map(err => {
            if (err.product) {
              return `Product with reference "${err.product.reference || 'unknown'}": ${err.error}`;
            }
            return `Unknown error: ${err.error}`;
          })
          .join('\n');

        try {
          await this.errorNotificationService.sendErrorEmail(
            `Errors creating products in bulk:\n${errorDetails}`,
          );
          
        } catch (emailError) {
          console.error('Error al enviar correo de notificación:', emailError.message);
        }
      }

      // Devolver la respuesta con el código de estado correcto
      return {
        response: {
          code: result.response.code,
          message: result.response.message,
          status: result.response.status,
        },
        errores: result.errors,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as BulkCreateErrorResponse;
        // Enviar correo de notificación para errores
        if (response.errors && response.errors.length > 0) {
          const errorDetails = response.errors
            .map(err => {
              if (err.product) {
                return `Product with reference "${err.product.reference || 'unknown'}": ${err.error}`;
              }
              return `Unknown error: ${err.error}`;
            })
            .join('\n');

          try {
            await this.errorNotificationService.sendErrorEmail(
              `Error al recibir información de Productos: \n${errorDetails}`,
            );

          } catch (emailError) {
            console.error('Error al enviar correo de notificación:', emailError.message);
          }
        }

        throw new HttpException(
          {
            response: {
              code: response.response.code,
              message: response.response.message,
              status: response.response.status,
            },
            errores: response.errors,
          },
          response.response.code,
        );
      }

      // Enviar correo para errores críticos
      try {
        await this.errorNotificationService.sendErrorEmail(
          `Critical error in createBulk: ${error.message}`,
        );
        
      } catch (emailError) {
        console.error('Error al enviar correo de notificación crítica:', emailError.message);
      }

      throw new InternalServerErrorException('Error creating products in bulk');
    }
  }
}