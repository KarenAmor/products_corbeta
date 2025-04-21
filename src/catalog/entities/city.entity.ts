import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'cities' })
export class City {
    @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
    @ApiProperty({ description: 'City ID' })
    id: number;

    @Column({ type: 'varchar', length: 5, unique: true })
    @ApiProperty({ description: 'City name' })
    name: string;

    @Column({
        name: 'minimun_order',
        type: 'decimal',
        precision: 22,
        scale: 2,
        default: 30000.0,
        comment: 'minimum allowed order total sale',
    })
    @ApiProperty({ description: 'Minimum allowed order total sale', default: 30000.0 })
    minimun_order: string;

    @Column({ type: 'char', length: 2, nullable: true })
    @ApiProperty({ description: 'Prefix', required: false })
    prefix?: string;

    @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    @ApiProperty({ description: 'Creation date', type: 'string', format: 'date-time' })
    created: Date;

    @Column({ type: 'timestamp', precision: 6, nullable: true })
    @ApiProperty({ description: 'Modification date', type: 'string', format: 'date-time' })
    modified: Date | null;
}
