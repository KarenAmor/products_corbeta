// src/product-stocks/dto/create-product-stock.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class ProductStockOperationDto {
  @IsNotEmpty()
  @IsString()
  product_id: string;

  @IsNotEmpty()
  @IsString()
  business_unit: string;

  @IsNotEmpty()
  @IsNumber()
  stock: number;

  @IsOptional()
  @IsNumber()
  is_active?: number;
}

export class ProductStockOperationWrapperDto {
  @ApiProperty({ description: 'Array of products to create', type: [ProductStockOperationDto] })
  @IsArray()
  @IsNotEmpty()
  product_stock: ProductStockOperationDto[];
}