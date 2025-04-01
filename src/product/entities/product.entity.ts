import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('products')
export class Product {
  @PrimaryColumn({ type: 'char', length: 20 })
  @ApiProperty({ description: 'Referencia del producto' })
  reference: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  @ApiProperty({ description: 'Nombre del producto' })
  name: string;

  @Column({ type: 'char', length: 3, nullable: true })
  @ApiProperty({ description: 'Unidad de embalaje', required: false })
  packing?: string;

  @Column({ type: 'decimal', precision: 15, scale: 8, nullable: true })
  @ApiProperty({ description: 'Tasa de conversión', required: false })
  convertionRate?: number;

  @Column({ type: 'char', length: 10, nullable: true })
  @ApiProperty({ description: 'Grupo de IVA', required: false })
  vatGroup?: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, unsigned: true, default: 0.00 })
  @ApiProperty({ description: 'Tasa de IVA', default: 0.00 })
  vat: number;

  @Column({ type: 'char', length: 3, nullable: true })
  @ApiProperty({ description: 'Unidad de embalaje destino', required: false })
  packingTo?: string;

  @Column({ type: 'tinyint', width: 4, unsigned: true, default: 1 })
  @ApiProperty({ description: '¿Está activo?', default: 1 })
  isActive: number;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  @ApiProperty({ description: 'Fecha de creación', type: 'string', format: 'date-time' })
  created: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  @ApiProperty({ description: 'Fecha de modificación', type: 'string', format: 'date-time' })
  modified: Date;
}