import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: 'user' }) // Rol por defecto: 'user'
  role: string;

  @Column({ default: 0 })
  loginCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastLoginAt: Date;
}