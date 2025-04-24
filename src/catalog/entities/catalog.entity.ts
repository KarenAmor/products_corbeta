import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { City} from '../entities/city.entity'

@Entity({ name: 'catalogs' })
export class Catalog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  @ApiProperty({ description: 'Catalog ID' })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  @ApiProperty({ description: 'Catalog name' })
  name: string;

  @Column({ name: 'city_id', type: 'int', unsigned: true })
  @ApiProperty({ description: 'City ID', required: true })
  @ManyToOne(() => City)
  @JoinColumn({ name: 'city_id' })
  city_id: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  @ApiProperty({ description: 'Is active?', default: 1 })
  is_active: boolean | number;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  @ApiProperty({ description: 'Creation date', type: 'string', format: 'date-time' })
  created: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6, nullable: true, name: 'modified' })
    @ApiProperty({ description: 'Modification date', type: 'string', format: 'date-time' })
    modified: Date | null;
}