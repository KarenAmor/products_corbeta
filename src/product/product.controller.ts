import {
  Controller,
  Post,
  Body,
  Query,
  InternalServerErrorException,
  Headers,
  UnauthorizedException,
} from '@nestjs/common'; // Importación de decoradores y excepciones comunes de NestJS.

import { ProductService } from './product.service'; // Servicio que maneja la lógica relacionada a productos.
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'; // Decoradores para documentar el controlador con Swagger.
import { ErrorNotificationService } from '../utils/error-notification.service'; // Servicio para enviar notificaciones de error.
import { Product } from './entities/product.entity'; // Entidad del producto.
import { CreateProductDto } from './dto/create-product-dto'; // DTO utilizado para crear productos.
import { ConfigService } from '@nestjs/config'; // Servicio para acceder a variables de entorno.
import * as bcrypt from 'bcrypt'; // Librería para comparación de contraseñas cifradas.

@ApiTags('products') // Agrupa este controlador bajo la etiqueta 'products' en la documentación Swagger.
@Controller('products') // Define el prefijo de ruta para este controlador.
export class ProductController {
  private readonly authUser: string; // Usuario de autenticación desde variables de entorno.
  private readonly authPasswordHash: string; // Hash de contraseña desde variables de entorno.

  constructor(
    private readonly productService: ProductService, // Inyección del servicio de productos.
    private readonly errorNotificationService: ErrorNotificationService, // Inyección del servicio de errores.
    private readonly configService: ConfigService, // Inyección del servicio de configuración.
  ) {
    // Se obtienen las credenciales desde las variables de entorno.
    const user = this.configService.get<string>('AUTH_USER');
    const passwordHash = this.configService.get<string>('AUTH_PASSWORD_HASH');

    // Se lanza un error si las credenciales no están configuradas.
    if (!user || !passwordHash) {
      throw new Error('Missing required authentication environment variables');
    }

    this.authUser = user;
    this.authPasswordHash = passwordHash;
  }

  // Método privado para verificar las credenciales enviadas en los headers.
  private async verifyCredentials(username: string, password: string): Promise<boolean> {
    const isPasswordValid = await bcrypt.compare(password, this.authPasswordHash); // Compara el password con el hash.
    return username === this.authUser && isPasswordValid; // Devuelve true si ambas credenciales coinciden.
  }

  @Post() // Define una ruta POST en '/products'.
  @ApiOperation({ summary: 'Create products in bulk' }) // Descripción de la operación en Swagger.
  @ApiResponse({ status: 201, description: 'Products created successfully', type: [Product] }) // Respuesta esperada en Swagger.
  async createBulk(
    @Body() productsData: CreateProductDto[], // Array de productos a crear (desde el body).
    @Query('batchSize') batchSize = 100, // Tamaño del lote (opcional, por query param).
    @Headers('username') username: string, // Nombre de usuario (desde headers).
    @Headers('password') password: string, // Contraseña (desde headers).
  ) {
    // Validación: si faltan credenciales, se lanza un 401.
    if (!username || !password) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    // Verificación de credenciales.
    const validCredentials = await this.verifyCredentials(username, password);
    if (!validCredentials) {
      throw new UnauthorizedException('Invalid credentials'); // Si no coinciden, se lanza 401.
    }

    try {
      // Se transforma cada producto y se asegura que 'is_active' sea numérico.
      const result = await this.productService.createBulk(
        productsData.map(product => ({
          ...product,
          is_active: product.is_active ? 1 : 0,
        })),
        Number(batchSize), // Se asegura que el batchSize sea un número.
      );

      // Si hubo errores al guardar productos o lotes...
      if (result.errors.length > 0) {
        // Se formatea cada error con detalle.
        const errorDetails = result.errors.map(err => {
          if (err.product) {
            return `Product with reference "${err.product.reference}": ${err.error}`;
          } else if (err.batch) {
            return `Error saving batch: ${err.error}`;
          }
          return `Unknown error: ${err}`;
        }).join('\n');

        // Se notifica por email con los errores.
        await this.errorNotificationService.sendErrorEmail(
          `Errors creating products in bulk:\n${errorDetails}`
        );
      }

      // Se retorna la respuesta estructurada esperada.
      return {
        respuesta: {
          codigoMensaje: result.response.code,
          mensaje: result.response.message,
          estadoMensaje: result.response.status,
        },
        errores: result.errors,
      };
    } catch (error) {
      // En caso de error inesperado, se notifica por correo.
      await this.errorNotificationService.sendErrorEmail(
        `Critical error in createBulk: ${error.message}`
      );

      // Y se lanza un error 500 al cliente.
      throw new InternalServerErrorException('Error creating products in bulk');
    }
  }
}