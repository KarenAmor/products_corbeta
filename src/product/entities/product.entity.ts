import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('products')
export class Product {
  @PrimaryColumn({ type: 'char', length: 20 })
  @ApiProperty({ description: 'Product reference' })
  reference: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  @ApiProperty({ description: 'Product name' })
  name: string;

  @Column({ type: 'char', length: 3, nullable: true })
  @ApiProperty({ description: 'Packing unit', required: false })
  packing?: string;

  @Column({ type: 'decimal', precision: 15, scale: 8, nullable: true })
  @ApiProperty({ description: 'Conversion rate', required: false })
  convertion_rate?: number;

  @Column({ type: 'char', length: 10, nullable: true })
  @ApiProperty({ description: 'VAT group', required: false })
  vat_group?: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, unsigned: true, default: 0.00 })
  @ApiProperty({ description: 'VAT rate', default: 0.00 })
  vat: number;

  @Column({ type: 'char', length: 3, nullable: true })
  @ApiProperty({ description: 'Destination packing unit', required: false })
  packing_to?: string;

  @Column({ type: 'tinyint', width: 4, unsigned: true, default: 1 })
  @ApiProperty({ description: 'Is active?', default: 1 })
  is_active: number;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  @ApiProperty({ description: 'Creation date', type: 'string', format: 'date-time' })
  created: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6, nullable: true, name: 'modified' })
  @ApiProperty({ description: 'Modification date', type: 'string', format: 'date-time' })
  modified: Date | null;
}