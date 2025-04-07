import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';

interface LogPayload {
  sync_type: string;
  record_id: string;
  table_name: string;
  event_type: string;
  result: string;
  error_message?: string;
}

@Injectable()
export class LogsService implements OnModuleInit {
  private logger: Logger;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.logger = createWinstonLogger(this.dataSource);
  }

  log(payload: LogPayload) {
    this.logger.info({
      message: `[LOG] ${payload.sync_type} - ${payload.table_name} - ${payload.event_type}`,
      ...payload,
      event_date: new Date(),
    });
  }  
}