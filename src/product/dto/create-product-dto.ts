import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsPositive, IsIn, MaxLength, IsNotEmpty, IsArray, IsOptional, IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ description: 'Product reference', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  reference: string;

  @ApiProperty({ description: 'Product name', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Packing unit', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  packing: string;

  @ApiProperty({ description: 'Conversion rate' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  convertion_rate: number;

  @ApiProperty({ description: 'VAT group', maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  vat_group: string;

  @ApiProperty({ description: 'VAT rate', default: 0.00 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  vat: number;

  @ApiProperty({ description: 'Destination packing unit', maxLength: 3 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  packing_to: string;

  @ApiProperty({ description: 'Is active?', default: 1 })
  @IsNumber()
  @IsNotEmpty()
  @IsIn([0, 1])
  is_active: number;

  @ApiPropertyOptional({ description: 'Creation date (optional)', type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created?: Date;

  @ApiPropertyOptional({ description: 'Creation date (optional)', type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  modified?: Date;
}

export class CreateProductsWrapperDto {
  @ApiProperty({ description: 'Array of products to create', type: [CreateProductDto] })
  @IsArray()
  @IsNotEmpty()
  products: CreateProductDto[];
}