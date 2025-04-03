import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the user', example: 1 })
  id: number;

  @Column({ unique: true })
  @ApiProperty({ description: 'User email', uniqueItems: true, example: 'user@example.com' })
  email: string;

  @Column()
  @ApiProperty({ description: 'User password', writeOnly: true, example: 'strongPassword123' })
  password: string;

  @Column({ default: 'user' }) // Rol por defecto: 'user'
  @ApiProperty({ description: 'User role', default: 'user', example: 'admin' })
  role: string;

  @Column({ default: 0 })
  @ApiProperty({ description: 'Number of times the user has logged in', default: 0, example: 5 })
  loginCount: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Timestamp when the user was created', example: '2023-01-01T12:00:00Z' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: "Timestamp of the user's last login", example: '2023-02-01T12:00:00Z' })
  lastLoginAt: Date;
}