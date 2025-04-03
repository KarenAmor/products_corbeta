import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsPositive, IsBoolean, MaxLength, IsDecimal } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product reference', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  reference: string;

  @ApiProperty({ description: 'Product name', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Packing unit', required: false, maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  packing?: string;

  @ApiProperty({ description: 'Conversion rate', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  convertionRate?: number;

  @ApiProperty({ description: 'VAT group', required: false, maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  vatGroup?: string;

  @ApiProperty({ description: 'VAT rate', default: 0.00 })
  @IsNumber()
  @IsPositive()
  vat: number;

  @ApiProperty({ description: 'Destination packing unit', required: false, maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  packingTo?: string;

  @ApiProperty({ description: 'Is active?', default: 1 })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}