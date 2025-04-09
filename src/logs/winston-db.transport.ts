import * as Transport from 'winston-transport';
import { DataSource } from 'typeorm';
import { LogEntity } from './entities/log.entity';
// Importa el módulo Transport de Winston para crear un transporte personalizado,
// DataSource de TypeORM para la conexión a la base de datos y LogEntity como la entidad que representa los logs en la base de datos.

interface DbTransportOptions extends Transport.TransportStreamOptions {
  dataSource: DataSource;
}
// Define una interfaz DbTransportOptions que extiende las opciones básicas de TransportStreamOptions de Winston,
// añadiendo una propiedad dataSource para pasar la conexión a la base de datos.

export class WinstonDbTransport extends Transport {
  // Define una clase WinstonDbTransport que extiende la clase base Transport de Winston para crear un transporte personalizado.

  private dataSource: DataSource;
  // Declara una propiedad privada para almacenar la instancia de DataSource, que se usará para interactuar con la base de datos.

  constructor(opts: DbTransportOptions) {
    // Define el constructor que recibe las opciones del transporte.

    super(opts);
    // Llama al constructor de la clase base Transport con las opciones recibidas.

    this.dataSource = opts.dataSource;
    // Asigna el DataSource recibido en las opciones a la propiedad privada de la clase.
  }

  async log(info: any, callback: () => void) {
    // Define el método log, requerido por Winston, que maneja el registro de logs.
    // Recibe un objeto info con los datos del log y un callback para notificar cuando el proceso termina.

    setImmediate(() => this.emit('logged', info));
    // Emite el evento 'logged' de forma asíncrona inmediata para notificar a Winston que el log ha sido procesado,
    // incluso antes de completar la operación en la base de datos.

    const {
      sync_type,
      record_id,
      table_name,
      data,
      event_date,
      result,
      error_message,
    } = info;
    // Desestructura el objeto info para extraer los campos esperados del log.

    try {
      if (!sync_type || !record_id || !table_name || !result) {
        console.warn('Incomplete log, not saving to database:', info);
        return callback();
      }
      // Verifica que los campos obligatorios estén presentes; si falta alguno, registra una advertencia en la consola
      // y llama al callback sin guardar el log en la base de datos.

      const repo = this.dataSource.getRepository(LogEntity);
      // Obtiene el repositorio de la entidad LogEntity desde el DataSource para interactuar con la tabla de logs.

      const log = repo.create({
        sync_type,
        record_id,
        table_name,
        data,
        event_date: event_date || new Date(),
        result,
        error_message,
      });
      // Crea una nueva instancia de LogEntity con los datos del log.
      // Si event_date no está definido, usa la fecha actual como valor predeterminado.

      await repo.save(log);
      // Guarda el log en la base de datos de forma asíncrona usando el repositorio.
    } catch (error) {
      console.error('Failed to save log to database:', error);
      // Si ocurre un error al guardar el log, lo captura y registra en la consola con el mensaje de error.
    }

    callback();
    // Llama al callback para indicar a Winston que el proceso de registro ha finalizado, independientemente de si hubo éxito o error.
  }
}