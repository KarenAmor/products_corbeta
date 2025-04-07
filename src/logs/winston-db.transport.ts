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

    const {
      sync_type,
      record_id,
      table_name,
      event_type,
      event_date,
      result,
      error_message,
    } = info;

    try {
      if (!sync_type || !record_id || !table_name || !event_type || !result) {
        console.warn('Incomplete log, not saving to database:', info);
        return callback();
      }

      const repo = this.dataSource.getRepository(LogEntity);
      const log = repo.create({
        sync_type,
        record_id,
        table_name,
        event_type,
        event_date: event_date || new Date(),
        result,
        error_message,
      });

      await repo.save(log);
    } catch (error) {
      console.error('Failed to save log to database:', error);
    }

    callback();
  }
}