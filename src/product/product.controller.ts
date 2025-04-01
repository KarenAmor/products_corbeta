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
  ) { }

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