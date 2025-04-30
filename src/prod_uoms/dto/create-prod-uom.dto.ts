import { IsString, IsInt, Min, MaxLength, IsIn, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProdUomDto {
  @IsString()
  product_id: string;

  @IsString()
  @MaxLength(3)
  unit_of_measure: string;

  @IsInt()
  @Min(0)
  min_order_qty: number;

  @IsInt()
  @Min(0)
  max_order_qty: number;

  @IsInt()
  @Min(0)
  order_increment: number;

  @IsIn([0, 1])
  is_active: number;
}

export class CreateProdUomWrapperDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateProdUomDto)
    product_unit_of_measure: CreateProdUomDto[];
  }