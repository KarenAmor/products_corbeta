import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('product_stocks')
export class ProductStock {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ type: 'char', length: 20, name: 'product_id', charset: 'utf8', collation: 'utf8_unicode_ci' })
  product_id: string;

  @Column({ type: 'int', unsigned: true, name: 'city_id' })
  city_id: number;

  @Column({ type: 'bigint', unsigned: true })
  stock: number;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  @ApiProperty({ description: 'Creation date', type: 'string', format: 'date-time' })
  created: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  @ApiProperty({ description: 'Modification date', type: 'string', format: 'date-time' })
  modified: Date;

  @Column({ type: 'enum', enum: ['CREATE', 'UPDATE', 'DELETE'], nullable: false, name: 'event_type' })
  @ApiProperty({ description: 'Event type (CREATE, UPDATE, DELETE)' })
  event_type: 'CREATE' | 'UPDATE' | 'DELETE';

  @Column({ type: 'boolean', default: false })
  @ApiProperty({ description: 'Processing status', default: false })
  processed: boolean;
}