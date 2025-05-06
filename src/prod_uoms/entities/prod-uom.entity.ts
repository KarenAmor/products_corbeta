// src/prod-uoms/entities/prod-uom.entity.ts

import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('prod_uoms')
export class ProdUom {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  product_id: string;

  @Column({ type: 'varchar', length: 10 })
  unit_of_measure: string;

  @Column({ type: 'int', nullable: false })
  min_order_qty: number;

  @Column({ type: 'int', nullable: false })
  max_order_qty: number;

  @Column({ type: 'int', nullable: false })
  order_increment: number;

  @Column({ type: 'tinyint', default: 1 })
  is_active: number;

  @CreateDateColumn({ type: 'timestamp' })
  created: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  modified: Date;
}