import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength, Min, Max, IsArray, IsNotEmpty, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';


export class ProductPriceOperationDto {
  @ApiProperty({ description: 'Business unit identifier', type: String })
  @IsString()
  business_unit: string;

  @ApiProperty({ description: 'Catalog identifier', type: String })
  @IsString()
  catalog: string;

  @ApiProperty({ description: 'Product reference', type: String, maxLength: 20 })
  @IsString()
  @MaxLength(20)
  product_id: string;

  @ApiProperty({ description: 'Price of the product', type: Number, nullable: true, default: 0.0000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Consumption tax value', type: Number, nullable: true })
  @IsNumber()
  @Min(0)
  vlr_impu_consumo: number | null;

  @ApiProperty({ description: 'Indicates if the price is active (1) or not (0)', type: Number, default: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  is_active: number;

  @ApiPropertyOptional({ description: 'Creation date (optional)', type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created?: Date;
}

export class ProductPriceOperationWrapperDto {
  @ApiProperty({ description: 'Array of product prices to process', type: [ProductPriceOperationDto] })
  @IsArray()
  @IsNotEmpty()
  product_prices: ProductPriceOperationDto[];
}