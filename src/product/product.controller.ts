import {
  Controller,
  Post,
  Body,
  Query,
  InternalServerErrorException,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

import { ProductService } from './product.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { Product } from './entities/product.entity';
import { CreateProductsWrapperDto } from './dto/create-product-dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CleanStringsPipe } from '../utils/clean-strings.pipe';

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
      const result = await this.productService.createBulk(
        productsData.map(product => ({
          ...product,
          is_active: product.is_active ? 1 : 0,
        })),
        Number(batchSize),
      );

      if (result.errors.length > 0) {
        const errorDetails = result.errors.map(err => {
          if (err.product) {
            return `Product with reference "${err.product.reference}": ${err.error}`;
          } else if (err.batch) {
            return `Error saving batch: ${err.error}`;
          }
          return `Unknown error: ${err}`;
        }).join('\n');

        await this.errorNotificationService.sendErrorEmail(
          `Errors creating products in bulk:\n${errorDetails}`
        );
      }

      return {
        respuesta: {
          codigoMensaje: result.response.code,
          mensaje: result.response.message,
          estadoMensaje: result.response.status,
        },
        errores: result.errors,
      };
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Critical error in createBulk: ${error.message}`
      );

      throw new InternalServerErrorException('Error creating products in bulk');
    }
  }
}