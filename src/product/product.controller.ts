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

@ApiTags('productos')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly errorNotificationService: ErrorNotificationService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiResponse({ status: 200, description: 'Lista de productos', type: [Product] })
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
  @ApiOperation({ summary: 'Buscar productos por palabra clave' })
  @ApiResponse({ status: 200, description: 'Productos encontrados', type: [Product] })
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
  @ApiOperation({ summary: 'Obtener producto por referencia' })
  @ApiResponse({ status: 200, description: 'Producto encontrado', type: Product })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
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
  @ApiOperation({ summary: 'Crear productos en masa' })
  @ApiResponse({ status: 201, description: 'Productos creados exitosamente', type: [Product] })
  async createBulk(@Body() productsData: Partial<Product>[], @Query('batchSize') batchSize = 100) {
    try {
      const result = await this.productService.createBulk(productsData, Number(batchSize));
  
      // Si hay errores, enviar un email con los detalles
      if (result.errors.length > 0) {
        const errorDetails = result.errors.map(err => {
          if (err.product) {
            return `Producto con reference "${err.product.reference}": ${err.error}`;
          } else if (err.batch) {
            return `Error al guardar lote: ${err.error}`;
          }
          return `Error desconocido: ${err}`;
        }).join('\n');
  
        await this.errorNotificationService.sendErrorEmail(
          `Errores al crear productos en masa:\n${errorDetails}`
        );
      }
  
      return result;
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Error crítico en createBulk: ${error.message}`
      );
      throw new InternalServerErrorException('Error al crear productos en masa');
    }
  }

  @Put(':reference')
  @ApiOperation({ summary: 'Actualizar producto' })
  @ApiResponse({ status: 200, description: 'Producto actualizado', type: Product })
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
  @ApiOperation({ summary: 'Eliminar producto' })
  @ApiResponse({ status: 200, description: 'Producto eliminado exitosamente' })
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