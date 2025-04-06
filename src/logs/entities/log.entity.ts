import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('log_sincronizacion')
export class LogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tipoSync: string; // API o Sincronización

  @Column()
  idRegistro: string; // ID del registro afectado

  @Column()
  tabla: string; // Tabla sincronizada

  @Column()
  tipoEvento: string; // Nuevo, Actualizar, Eliminar

  @Column()
  fecha: Date; // Fecha Evento

  @Column()
  resultado: string; // Exitoso, Fallido

  @Column({ nullable: true })
  mensajeError?: string; // Mensaje Error
}