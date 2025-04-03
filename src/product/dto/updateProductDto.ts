import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from '../dto/createProductDto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
