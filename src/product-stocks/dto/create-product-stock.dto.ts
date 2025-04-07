import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsBoolean, IsOptional, MaxLength, IsIn, Min, IsNotEmpty } from 'class-validator';

export class CreateProductStockDto {
  @ApiProperty({ description: 'Product identifier', maxLength: 20, example: 'PROD-1234567890' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  product_id: string;

  @ApiProperty({ description: 'City identifier where stock is located', example: 1 })
  @IsInt()
  @Min(1)
  city_id: number;

  @ApiProperty({ description: 'Available stock quantity', example: 100 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ description: 'Event type (CREATE, UPDATE, DELETE)', example: 'CREATE' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['CREATE', 'UPDATE', 'DELETE'])
  event_type: 'CREATE' | 'UPDATE' | 'DELETE';

  @ApiProperty({ description: 'Processing status', default: false })
  @IsBoolean()
  @IsOptional()
  processed?: boolean;
}