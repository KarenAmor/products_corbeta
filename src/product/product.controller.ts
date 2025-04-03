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
} from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorNotificationService } from './error-notification.service';
import { Product } from './entities/product.entity';
import { CreateProductDto } from '../product/dto/createProductDto';
import { UpdateProductDto } from '../product/dto/updateProductDto';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly errorNotificationService: ErrorNotificationService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'List of products', type: [Product] })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    try {
      return await this.productService.findAll(page, limit);
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Error in findAll: ${error.message}`,
      );
      throw new InternalServerErrorException('Error retrieving products');
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products by keyword' })
  @ApiResponse({ status: 200, description: 'Found products', type: [Product] })
  async search(@Query('keyword') keyword: string): Promise<Product[]> {
    try {
      return await this.productService.searchByKeyword(keyword);
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Error in search: ${error.message}`,
      );
      throw new InternalServerErrorException('Error searching for products');
    }
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Get product by reference' })
  @ApiResponse({ status: 200, description: 'Product found', type: Product })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('reference') reference: string): Promise<Product> {
    try {
      return await this.productService.findOne(reference);
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Error in findOne: ${error.message}`,
      );
      throw new InternalServerErrorException('Error retrieving the product');
    }
  }
  
  @Post()
  @ApiOperation({ summary: 'Create products in bulk' })
  @ApiResponse({ status: 201, description: 'Products created successfully', type: [Product] })
  async createBulk(@Body() productsData: CreateProductDto[], @Query('batchSize') batchSize = 100) {
    try {
      const result = await this.productService.createBulk(
        productsData.map(product => ({
          ...product,
          isActive: product.isActive ? 1 : 0, // Conversión rápida de boolean a number
        })),
        Number(batchSize),
      );
      
      // If there are errors, send an email with the details
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

  @Put(':reference')
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200, description: 'Product updated', type: Product })
  async update(@Param('reference') reference: string, @Body() product: UpdateProductDto): Promise<Product> {
    try {
      return await this.productService.update(reference, {
        ...product,
        isActive: product.isActive !== undefined ? (product.isActive ? 1 : 0) : undefined,
      });
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Error in update: ${error.message}`,
      );
      throw new InternalServerErrorException('Error updating the product');
    }
  }

  @Delete(':reference')
  @ApiOperation({ summary: 'Delete product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  async remove(@Param('reference') reference: string): Promise<{ message: string }> {
    try {
      await this.productService.remove(reference);
      return { message: 'Product deleted successfully' };
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Error in remove: ${error.message}`,
      );
      throw new InternalServerErrorException('Error deleting the product');
    }
  }
}