import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sync_log')
export class LogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sync_type: string;

  @Column()
  record_id: string;

  @Column()
  table_name: string;

  @Column()
  event_type: string;

  @Column()
  event_date: Date;

  @Column()
  result: string;

  @Column({ nullable: true })
  error_message?: string;
}