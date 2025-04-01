import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('product_logs')
export class ProductLog {
  @PrimaryGeneratedColumn()
  @ApiProperty({
    description: 'Unique identifier for the product log entry',
    example: 1,
  })
  id: number;

  @Column()
  @ApiProperty({
    description: 'Reference of the product associated with this log',
    example: 'P12345',
  })
  reference: string;

  @Column()
  @ApiProperty({
    description: 'Action performed on the product (e.g., CREATE, UPDATE, DELETE)',
    example: 'CREATE',
  })
  action: string;

  @Column({ type: 'json', nullable: true })
  @ApiProperty({
    description: 'Old data before the action was performed (if applicable)',
    type: 'object',
    nullable: true,
    additionalProperties: true,  // Allow any key-value pairs
  })
  old_data: any;

  @Column({ type: 'json', nullable: true })
  @ApiProperty({
    description: 'New data after the action was performed (if applicable)',
    type: 'object',
    nullable: true,
    additionalProperties: true,  // Allow any key-value pairs
  })
  new_data: any;

  @CreateDateColumn()
  @ApiProperty({
    description: 'Timestamp of when the action was performed',
    example: '2025-04-01T12:00:00.000Z',
  })
  performed_at: Date;
}