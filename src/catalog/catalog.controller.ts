import {
  Controller,
  Post,
  Body,
  Query,
  InternalServerErrorException,
  Headers,
  UnauthorizedException,
  HttpException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { ErrorNotificationService } from '../utils/error-notification.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CleanStringsPipe } from '../utils/clean-strings.pipe';
import { CreateCatalogsWrapperDto } from './dto/create-catalog.dto';
import { Catalog } from './entities/catalog.entity';

// Interfaz para tipar errores de respuesta masiva
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

  // Validar credenciales básicas
  private async verifyCredentials(username: string, password: string): Promise<boolean> {
    const isPasswordValid = await bcrypt.compare(password, this.authPasswordHash);
    return username === this.authUser && isPasswordValid;
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create catalogs in bulk' })
  @ApiResponse({ status: 201, description: 'Catalogs created successfully', type: [Catalog] })
  async createBulk(
    @Body(CleanStringsPipe) wrapper: CreateCatalogsWrapperDto,
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
      const catalogsData = wrapper.catalogs;
  
      const result = await this.catalogService.createBulk(
        catalogsData.map(catalog => ({
          name_catalog: catalog.name_catalog,
          business_unit: catalog.business_unit,
          is_active: Number(catalog.is_active),
        })),
        Number(batchSize),
      );
  
      if (result.errors.length > 0) {
        const errorDetails = result.errors
          .map(err => {
            const name = err.catalog?.name_catalog || 'unknown';
            return `Catalog "${name}": ${err.error}`;
          })
          .join('\n');
  
  
        try {
          await this.errorNotificationService.sendErrorEmail(
            `Error al recibir informacion de catalogos:\n${errorDetails}`,
          );
        
        } catch (emailError) {
          console.error('Failed to send error notification email:', emailError.message);
        }
      }
  
      return {
        response: {
          code: result.response.code,
          message: result.response.message,
          status: result.response.status,
        },
        errores: result.errors,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as BulkCreateErrorResponse;
  
        if (response.errors && response.errors.length > 0) {
          const errorDetails = response.errors
            .map(err => {
              const name = err.catalog?.name_catalog || 'unknown';
              return `Catalog "${name}": ${err.error}`;
            })
            .join('\n');
  
  
          try {
            await this.errorNotificationService.sendErrorEmail(
              `Error al recibir información de catalogos:\n${errorDetails}`,
            );
           
          } catch (emailError) {
            console.error('Failed to send error notification email:', emailError.message);
          }
        }
  
        throw new HttpException(
          {
            response: {
              code: response.response.code,
              message: response.response.message,
              status: response.response.status,
            },
            errores: response.errors,
          },
          response.response.code,
        );
      }
  
      try {
        await this.errorNotificationService.sendErrorEmail(
          `Error al recibir información de catalogos: ${error.message}`,
        );
        
      } catch (emailError) {
        console.error('Failed to send critical error notification:', emailError.message);
      }
  
      throw new InternalServerErrorException('Error creating catalogs in bulk');
    }
  }  
}