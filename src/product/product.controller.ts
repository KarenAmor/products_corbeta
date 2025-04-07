import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  InternalServerErrorException,
  UseGuards 
} from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { Product } from './entities/product.entity';
import { CreateProductDto } from '../product/dto/createProductDto';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly errorNotificationService: ErrorNotificationService,
  ) { }


  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create products in bulk' })
  @ApiResponse({ status: 201, description: 'Products created successfully', type: [Product] })
  async createBulk(
    @Body() productsData: CreateProductDto[],
    @Query('batchSize') batchSize = 100,
  ) {
    try {
      const result = await this.productService.createBulk(
        productsData.map(product => ({
          ...product,
          is_active: product.is_active ? 1 : 0, // Conversión de boolean a number
        })),
        Number(batchSize),
      );
      
      // Si hay errores, se envía un correo con los detalles
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
  
      return result;
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Critical error in createBulk: ${error.message}`
      );
      throw new InternalServerErrorException('Error creating products in bulk');
    }
  } 
}