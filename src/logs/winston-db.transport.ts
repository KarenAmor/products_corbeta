import * as Transport from 'winston-transport';
import { DataSource } from 'typeorm';
import { LogEntity } from './entities/log.entity';

interface DbTransportOptions extends Transport.TransportStreamOptions {
  dataSource: DataSource;
}

export class WinstonDbTransport extends Transport {
  private dataSource: DataSource;

  constructor(opts: DbTransportOptions) {
    super(opts);
    this.dataSource = opts.dataSource;
  }

  async log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    const { tipoSync, idRegistro, tabla, tipoEvento, fecha, resultado, mensajeError } = info;

    try {
      const repo = this.dataSource.getRepository(LogEntity);
      const log = repo.create({
        tipoSync,
        idRegistro,
        tabla,
        tipoEvento,
        fecha: fecha || new Date(),
        resultado,
        mensajeError,
      });
      
      if (!tipoSync || !idRegistro || !tabla || !tipoEvento || !resultado) {
        console.warn('Log incompleto, no se guardará en la base de datos:', info);
        return callback();
      }
      
      await repo.save(log);
    } catch (error) {
      console.error('Error al guardar el log en la base de datos:', error);
    }

    callback();
  }
}