// src/prod-uoms/prod-uoms.controller.ts

import {
    Controller,
    Post,
    Body,
    BadRequestException,
    Headers,
    Query,
    UnauthorizedException,
    InternalServerErrorException,
    HttpException,
  } from '@nestjs/common';
  import { ProdUomsService } from './prod-uoms.service';
  import { ConfigService } from '@nestjs/config';
  import * as bcrypt from 'bcrypt';
  import { ErrorNotificationService } from '../utils/error-notification.service';
  import { CreateProdUomWrapperDto } from './dto/create-prod-uom.dto';
  import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
  import { CleanStringsPipe } from '../utils/clean-strings.pipe';
  
  interface BulkCreateErrorResponse {
    response: {
      code: number;
      message: string;
      status: string;
    };
    errors: Array<{
      uom?: any;
      error: string;
      index: number;
    }>;
  }
  
  @ApiTags('prod-uoms')
  @Controller('prod-uoms')
  export class ProdUomsController {
    private readonly authUser: string;
    private readonly authPasswordHash: string;
  
    constructor(
      private readonly prodUomsService: ProdUomsService,
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
    @ApiOperation({ summary: 'Process product UOMs (create, update, or delete based on is_active)' })
    @ApiBody({ type: CreateProdUomWrapperDto })
    @ApiResponse({
      status: 200,
      description: 'UOMs processed successfully.',
      schema: {
        example: {
          response: {
            code: 200,
            message: 'Transaction Successful',
            status: 'successful',
          },
          errors: [],
        },
      },
    })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 404, description: 'UOM or related record not found' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async processUoms(
      @Body(CleanStringsPipe) wrapperDto: CreateProdUomWrapperDto,
      @Query('batchSize') batchSize = 100,
      @Headers('username') username: string,
      @Headers('password') password: string,
    ) {
      const { product_unit_of_measure } = wrapperDto;
  
      if (!product_unit_of_measure || !Array.isArray(product_unit_of_measure) || product_unit_of_measure.length === 0) {
        throw new BadRequestException('No UOMs provided');
      }
  
      if (!username || !password) {
        throw new UnauthorizedException('Missing authentication headers');
      }
  
      const validCredentials = await this.verifyCredentials(username, password);
      if (!validCredentials) {
        throw new UnauthorizedException('Invalid credentials');
      }
  
      try {
        const result = await this.prodUomsService.createBulk(product_unit_of_measure, Number(batchSize));
  
        if (result.errors.length > 0) {
          const errorDetails = result.errors
            .map(err => {
              if (err.uom) {
                return `UOM for product_id "${err.uom.product_id || 'unknown'}": ${err.error}`;
              }
              return `Unknown error: ${err.error}`;
            })
            .join('\n');
  
          try {
            await this.errorNotificationService.sendErrorEmail(
              `Errors processing product UOMs:\n${errorDetails}`,
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
          errors: result.errors,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          const response = error.getResponse() as BulkCreateErrorResponse;
  
          if (response.errors && response.errors.length > 0) {
            const errorDetails = response.errors
              .map(err => {
                if (err.uom) {
                  return `UOM for product_id "${err.uom.product_id || 'unknown'}": ${err.error}`;
                }
                return `Unknown error: ${err.error}`;
              })
              .join('\n');
  
            try {
              await this.errorNotificationService.sendErrorEmail(
                `Error al recibir informacion de unidades de medida de productos:\n${errorDetails}`,
              );
            } catch (emailError) {
              console.error('Failed to send critical error notification email:', emailError.message);
            }
          }
  
          throw new HttpException(
            {
              response: {
                code: response.response.code,
                message: response.response.message,
                status: response.response.status,
              },
              errors: response.errors,
            },
            response.response.code,
          );
        }
  
        try {
          await this.errorNotificationService.sendErrorEmail(
            `Critical error in processUoms: ${error.message}`,
          );
        } catch (emailError) {
          console.error('Failed to send critical error notification email:', emailError.message);
        }
  
        throw new InternalServerErrorException('Error processing product UOMs');
      }
    }
  }  