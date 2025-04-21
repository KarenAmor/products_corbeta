// src/catalogs/dto/create-catalog.dto.ts

import { IsString, IsInt, IsBoolean, IsOptional, MaxLength, IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCatalogDto {
  @ApiProperty({ description: 'Catalog name', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  name: string;

  @ApiProperty({ description: 'City ID' })
  @IsInt()
  city_id: number;

  @ApiProperty({ description: 'Is active?', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateCatalogsWrapperDto {
  @ApiProperty({ description: 'Array of catalogs to create', type: [CreateCatalogDto] })
  @IsArray()
  @IsNotEmpty()
  catalogs: CreateCatalogDto[];
}