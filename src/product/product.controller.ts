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
  import { ErrorNotificationService } from './error-notification.service';
  import { Product } from './entities/product.entity';
  
  @Controller('products')
  export class ProductController {
    constructor(
      private readonly productService: ProductService,
      private readonly errorNotificationService: ErrorNotificationService,
    ) {}
  
    @Get()
    async findAll(
      @Query('page') page: number = 1,
      @Query('limit') limit: number = 10,
    ) {
      try {
        return await this.productService.findAll(page, limit);
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Error en findAll: ${error.message}`,
        );
        throw new InternalServerErrorException('Error al obtener productos');
      }
    }
  
    @Get('search')
    async search(@Query('keyword') keyword: string): Promise<Product[]> {
      try {
        return await this.productService.searchByKeyword(keyword);
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Error en search: ${error.message}`,
        );
        throw new InternalServerErrorException('Error en la búsqueda de productos');
      }
    }
  
    @Get(':reference')
    async findOne(@Param('reference') reference: string): Promise<Product> {
      try {
        return await this.productService.findOne(reference);
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Error en findOne: ${error.message}`,
        );
        throw new InternalServerErrorException('Error al obtener el producto');
      }
    }
  
    @Post()
    async create(@Body() product: Product): Promise<Product> {
      try {
        return await this.productService.create(product);
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Error en create: ${error.message}`,
        );
        throw new InternalServerErrorException('Error al crear el producto');
      }
    }
  
    @Put(':reference')
    async update(@Param('reference') reference: string, @Body() product: Partial<Product>): Promise<Product> {
      try {
        return await this.productService.update(reference, product);
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Error en update: ${error.message}`,
        );
        throw new InternalServerErrorException('Error al actualizar el producto');
      }
    }
  
    @Delete(':reference')
    async remove(@Param('reference') reference: string): Promise<{ message: string }> {
      try {
        await this.productService.remove(reference);
        return { message: 'Product deleted successfully' };
      } catch (error) {
        await this.errorNotificationService.sendErrorEmail(
          `Error en remove: ${error.message}`,
        );
        throw new InternalServerErrorException('Error al eliminar el producto');
      }
    }
  }  