import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryColumn({ type: 'char', length: 20 })
  reference: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name: string;

  @Column({ type: 'char', length: 3, nullable: true })
  packing?: string;

  @Column({ type: 'decimal', precision: 15, scale: 8, nullable: true })
  convertionRate?: number;

  @Column({ type: 'char', length: 10, nullable: true })
  vatGroup?: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, unsigned: true, default: 0.00 })
  vat: number;

  @Column({ type: 'char', length: 3, nullable: true })
  packingTo?: string;

  @Column({ type: 'tinyint', width: 4, unsigned: true, default: 1 })
  isActive: number;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
created: Date;

@UpdateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
modified: Date;
}