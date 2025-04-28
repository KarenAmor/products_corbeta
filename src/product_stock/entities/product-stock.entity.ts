// src/product-stocks/entities/product-stock.entity.ts

import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('product_stocks')
export class ProductStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id', type: 'char', length: 20 })
  product_id: string;

  @Column({ name: 'city_id', type: 'int' })
  city_id: number;

  @Column({ name: 'stock', type: 'bigint', unsigned: true })
  stock: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 4, nullable: true, default: () => '1' })
  is_active: number;

  @Column({ name: 'created', type: 'datetime' })
  created: Date;

  @Column({ name: 'modified', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  modified: Date;
}