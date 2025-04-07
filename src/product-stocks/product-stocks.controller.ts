import {
    Controller,
    Post,
    Body,
    Query,
    InternalServerErrorException,
    UseGuards,
  } from '@nestjs/common';

  import { ProductStockService } from '../product-stocks/product-stocks.service'; 
  import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { ErrorNotificationService } from '../utils/error-notification.service';
  import { ProductStock } from './entities/product-stock.entity'; 
  import { CreateProductStockDto } from './dto/create-product-stock.dto'; 
  import { AuthGuard } from '../auth/auth.guard';
  
  @ApiTags('product-stock')
  @Controller('product-stock')
  export class ProductStockController {
    constructor(
      private readonly productStockService: ProductStockService,
      private readonly errorNotificationService: ErrorNotificationService,
    ) {}
  
    @Post()
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Create product stock entries in bulk' })
    @ApiResponse({ status: 201, description: 'Stock entries created successfully', type: [ProductStock] })
    async createBulk(
      @Body() stockData: CreateProductStockDto[],
      @Query('batchSize') batchSize = 100,
    ) {
      try {
        const result = await this.productStockService.createBulk(
          stockData.map(stock => ({
            ...stock,
            processed: stock.processed ?? false, // Aseguramos valor por defecto
          })),
          Number(batchSize),
        );
  
        // Si hay errores, se envía un correo con los detalles
        if (result.errors.length > 0) {
          const errorDetails = result.errors.map(err => {
            if (err.stock) {
              return `Stock for product "${err.stock.product_id}" in city "${err.stock.city_id}": ${err.error}`;
            } else if (err.batch) {
              return `Error saving batch: ${err.error}`;
            }
            return `Unknown error: ${err}`;
          }).join('\n');
  
          await this.errorNotificationService.sendErrorEmail(
            `Errors creating product stock in bulk:\n${errorDetails}`,
          );
        }
  
        return result;
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Critical error in createBulk: ${error.message}`,
        );
        throw new InternalServerErrorException('Error creating product stock in bulk');
      }
    }
  }