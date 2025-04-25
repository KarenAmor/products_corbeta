import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('product_prices')
export class ProductPrice {
  @ApiProperty({ description: 'Catalog ID', type: Number })
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  catalog_id: number;

  @ApiProperty({ description: 'Product reference', type: String, maxLength: 20 })
  @PrimaryColumn({ type: 'char', length: 20 })
  product_reference: string;

  @ApiProperty({ description: 'Price of the product', type: Number, nullable: true, default: 0.0000 })
  @Column({ type: 'decimal', precision: 17, scale: 4, unsigned: true, nullable: true, default: 0.0000 })
  price: number;

  @ApiProperty({ description: 'Discount applied to the product', type: Number, default: 0.00 })
  @Column({ type: 'decimal', precision: 4, scale: 2, unsigned: true, nullable: false, default: 0.00 })
  discount: number;

  @ApiProperty({ description: 'Consumption tax value', type: Number, nullable: true })
  @Column({ type: 'decimal', precision: 19, scale: 4, unsigned: true, nullable: true })
  vlr_impu_consumo: number | null;

  @ApiProperty({ description: 'Consumption tax rate', type: Number, nullable: true })
  @Column({ type: 'int', unsigned: true, nullable: true })
  impuest_consumo: number | null;

  @ApiProperty({ description: 'Indicates if the price is active (1) or not (0)', type: Number, default: 1 })
  @Column({ type: 'tinyint', unsigned: true, nullable: false, default: 1 })
  is_active: number;

  @ApiProperty({ description: 'Creation date', type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  created: Date;

  @ApiProperty({ description: 'Modification date', type: String, format: 'date-time', nullable: true })
  @UpdateDateColumn({ type: 'timestamp', precision: 6, nullable: true, name: 'modified' })
  modified: Date | null;
}