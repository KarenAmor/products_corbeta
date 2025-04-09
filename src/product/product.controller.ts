import {
  Controller,
  Post,
  Body,
  Query,
  InternalServerErrorException,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
// Importa decoradores y excepciones de NestJS para definir el controlador, manejar solicitudes HTTP y lanzar errores.

import { ProductService } from './product.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product-dto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
// Importa el servicio de productos, herramientas de Swagger para documentación, un servicio de notificación de errores, 
// la entidad Product, un DTO (Data Transfer Object) para los datos de entrada, el servicio de configuración y bcrypt para manejar contraseñas.

@ApiTags('products')
// Etiqueta este controlador con la categoría "products" en la documentación de Swagger.

@Controller('products')
// Define que este controlador manejará rutas bajo el prefijo "/products".

export class ProductController {
  private readonly authUser: string;
  private readonly authPasswordHash: string;
  // Declara variables privadas para almacenar el usuario y el hash de la contraseña de autenticación.

  constructor(
    private readonly productService: ProductService,
    private readonly errorNotificationService: ErrorNotificationService,
    private readonly configService: ConfigService,
  ) {
    // Inyecta el servicio de productos, el servicio de notificación de errores y el servicio de configuración.

    const user = this.configService.get<string>('AUTH_USER');
    const passwordHash = this.configService.get<string>('AUTH_PASSWORD_HASH');
    // Obtiene las variables de entorno AUTH_USER y AUTH_PASSWORD_HASH.

    if (!user || !passwordHash) {
      throw new Error('Missing required authentication environment variables');
      // Lanza un error si las variables de entorno requeridas no están definidas.
    }

    this.authUser = user;
    this.authPasswordHash = passwordHash;
    // Asigna las variables de entorno a las propiedades privadas.
  }

  private verifyCredentials(username: string, password: string): boolean {
    // Método privado para verificar las credenciales proporcionadas por el cliente.
    return username === this.authUser && bcrypt.compareSync(password, this.authPasswordHash);
    // Compara el usuario con el almacenado y verifica la contraseña usando bcrypt contra el hash almacenado.
  }

  @Post()
  // Define un endpoint POST en "/products" para manejar solicitudes de creación masiva.

  @ApiOperation({ summary: 'Create products in bulk' })
  // Documenta en Swagger que este endpoint crea productos en masa.

  @ApiResponse({ status: 201, description: 'Products created successfully', type: [Product] })
  // Documenta en Swagger que el endpoint devuelve un código 201 y una lista de productos si es exitoso.

  async createBulk(
    @Body() productsData: CreateProductDto[],
    @Query('batchSize') batchSize = 100,
    @Headers('x-auth-username') username: string,
    @Headers('x-auth-password') password: string,
  ) {
    // Método que maneja la creación masiva de productos. Recibe los datos en el cuerpo (body), 
    // un tamaño de lote opcional como query param (por defecto 100), y credenciales en los headers.

    if (!username || !password) {
      throw new UnauthorizedException('Missing authentication headers');
      // Lanza un error 401 si faltan las cabeceras de autenticación.
    }

    if (!this.verifyCredentials(username, password)) {
      throw new UnauthorizedException('Invalid credentials');
      // Lanza un error 401 si las credenciales no son válidas.
    }

    try {
      const result = await this.productService.createBulk(
        productsData.map(product => ({
          ...product,
          is_active: product.is_active ? 1 : 0,
        })),
        Number(batchSize),
      );
      // Llama al método createBulk del ProductService, transformando los datos de entrada 
      // para convertir is_active a 1 o 0 según su valor booleano, y pasa el batchSize como número.

      if (result.errors.length > 0) {
        const errorDetails = result.errors.map(err => {
          if (err.product) {
            return `Product with reference "${err.product.reference}": ${err.error}`;
          } else if (err.batch) {
            return `Error saving batch: ${err.error}`;
          }
          return `Unknown error: ${err}`;
        }).join('\n');
        // Si hay errores, formatea los detalles de los errores en un string con saltos de línea.

        await this.errorNotificationService.sendErrorEmail(
          `Errors creating products in bulk:\n${errorDetails}`
        );
        // Envía un correo con los detalles de los errores usando el servicio de notificación.
      }

      return {
        respuesta: {
          codigoMensaje: result.response.code,
          mensaje: result.response.message,
          estadoMensaje: result.response.status,
        },
        errores: result.errors,
      };
      // Devuelve un objeto con la respuesta (código, mensaje, estado) y la lista de errores.
    } catch (error) {
      await this.errorNotificationService.sendErrorEmail(
        `Critical error in createBulk: ${error.message}`
      );
      // Si ocurre un error crítico, envía un correo con el mensaje del error.

      throw new InternalServerErrorException('Error creating products in bulk');
      // Lanza un error 500 al cliente indicando un fallo en la creación masiva.
    }
  }
}