import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';

interface LogPayload {
  tipoSync: string;
  idRegistro: string;
  tabla: string;
  tipoEvento: string;
  resultado: string;
  mensajeError?: string;
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
      message: `[LOG] ${payload.tipoSync} - ${payload.tabla} - ${payload.tipoEvento}`,
      ...payload,
      fecha: new Date(),
    });
  }  
}