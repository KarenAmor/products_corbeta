import {
  Controller,
  Post,
  Body,
  Query,
  InternalServerErrorException,
  Headers,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CleanStringsPipe } from '../utils/clean-strings.pipe';
import { CreateCatalogsWrapperDto } from './dto/create-catalog.dto';
import { Catalog } from './entities/catalog.entity';

interface BulkCreateErrorResponse {
  response: {
    code: number;
    message: string;
    status: string;
  };
  errors: Array<{
    catalog?: any;
    error: string;
    index: number;
  }>;
}

@ApiTags('catalogs')
@Controller('catalogs')
export class CatalogController {
  private readonly authUser: string;
  private readonly authPasswordHash: string;

  constructor(
    private readonly catalogService: CatalogService,
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
  @ApiOperation({ summary: 'Crear catálogos en lote' })
  @ApiResponse({ status: 201, description: 'Catálogos creados exitosamente', type: [Catalog] })
  async createBulk(
    @Body(CleanStringsPipe) wrapper: CreateCatalogsWrapperDto,
    @Query('batchSize') batchSize = 100,
    @Headers('username') username: string,
    @Headers('password') password: string,
  ) {
    if (!username || !password) {
      throw new UnauthorizedException('Faltan cabeceras de autenticación');
    }

    const validCredentials = await this.verifyCredentials(username, password);
    if (!validCredentials) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    try {
      const catalogsData = wrapper.catalogs;
      const result = await this.catalogService.createBulk(
        catalogsData.map(catalog => ({
          ...catalog,
          is_active: catalog.is_active ? 1 : 0,
        })),
        Number(batchSize),
      );

      if (result.errors.length > 0) {
        const errorDetails = result.errors
          .map(err => {
            if (err.catalog) {
              return `Catálogo con nombre "${err.catalog.name || 'desconocido'}": ${err.error}`;
            } else if (err.batch) {
              return `Error al guardar el lote: ${err.error}`;
            }
            return `Error desconocido: ${err}`;
          })
          .join('\n');

        await this.errorNotificationService.sendErrorEmail(
          `Errores al crear catálogos en lote:\n${errorDetails}`,
        );
      }

      // Establecer el código de estado HTTP basado en el resultado
      throw new HttpException(
        {
          response: {
            code: result.response.code,
            menssage: result.response.message,
            status: result.response.status,
          },
          errores: result.errors,
        },
        result.response.code, // Usar el código de estado del resultado
      );
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as BulkCreateErrorResponse;
        throw new HttpException(
          {
            response: {
              code: response.response.code,
              menssage: response.response.message,
              status: response.response.status,
            },
            errores: response.errors,
          },
          response.response.code, // Usar el código de estado del error
        );
      }

      await this.errorNotificationService.sendErrorEmail(
        `Error crítico en createBulk de catálogos: ${error.message}`,
      );
      throw new InternalServerErrorException('Error al crear catálogos en lote');
    }
  }
}