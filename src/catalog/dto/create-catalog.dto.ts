import { IsString, IsInt, MaxLength, IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCatalogDto {
  @ApiProperty({ description: 'Catalog name', example: 'AUTOFOTON', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  name_catalog: string;

  @ApiProperty({ description: 'Business unit (city name)', example: 'DIBOG' })
  @IsString()
  business_unit: string;

  @ApiProperty({ description: 'Is active? (1 = true, 0 = false)', example: 1 })
  @IsInt()
  is_active: number;
}

export class CreateCatalogsWrapperDto {
  @ApiProperty({ description: 'Array of catalogs to create', type: [CreateCatalogDto] })
  @IsArray()
  @IsNotEmpty()
  catalogs: CreateCatalogDto[];
}