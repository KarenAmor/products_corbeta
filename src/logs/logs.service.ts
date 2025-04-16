import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';
// Importa el decorador Injectable y la interfaz OnModuleInit de NestJS, DataSource de TypeORM para la conexión a la base de datos,
// Logger de Winston para el registro de logs y una función personalizada createWinstonLogger para configurar el logger.

interface LogPayload {
  sync_type: string;
  record_id: string;
  process: string;
  row_data: any;
  result: string;
  error_message?: string;
  event_date: Date;
}
// Define una interfaz LogPayload que especifica la estructura de los datos que se pasarán al método log:
// - sync_type: tipo de sincronización (ej. 'API').
// - record_id: identificador del registro.
// - table_name: nombre de la tabla afectada.
// - data: datos asociados al evento.
// - result: resultado del evento (ej. 'exitoso' o 'fallido').
// - error_message: mensaje de error opcional.
// - event_date: fecha del evento.

@Injectable()
// Marca esta clase como un servicio inyectable en otros componentes de NestJS.

export class LogsService implements OnModuleInit {
  // Define la clase LogsService que implementa la interfaz OnModuleInit, lo que permite ejecutar lógica al inicializar el módulo.

  private logger: Logger;
  // Declara una propiedad privada para almacenar una instancia de Logger de Winston.

  constructor(private readonly dataSource: DataSource) {}
  // Define el constructor que recibe una instancia de DataSource (conexión a la base de datos) como dependencia,
  // marcada como readonly para indicar que no se modificará después de la inyección.

  onModuleInit() {
    // Método que se ejecuta automáticamente cuando el módulo de NestJS se inicializa.

    this.logger = createWinstonLogger(this.dataSource);
    // Inicializa la propiedad logger llamando a la función createWinstonLogger,
    // pasando el DataSource como argumento para configurar el logger con la conexión a la base de datos.
  }

  log(payload: LogPayload) {
    this.logger.info({
      message: `[LOG] ${payload.sync_type} - ${payload.process} - ${payload.result}`,
      ...payload,
      event_date: new Date(),
    });
  } 
  // Define un método log que recibe un objeto conforme a la interfaz LogPayload.
  // Actualmente, este método está vacío (sin implementación), lo que sugiere que es un esqueleto o placeholder
  // para una funcionalidad futura, como registrar el payload en Winston o en la base de datos.
}