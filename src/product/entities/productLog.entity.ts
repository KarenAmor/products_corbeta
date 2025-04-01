import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('product_logs')
export class ProductLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reference: string;

  @Column()
  action: string;

  @Column({ type: 'json', nullable: true })
  old_data: any;

  @Column({ type: 'json', nullable: true })
  new_data: any;

  @CreateDateColumn()
  performed_at: Date;
}