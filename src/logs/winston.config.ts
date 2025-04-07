import * as winston from 'winston';
import { WinstonDbTransport } from './winston-db.transport';
import { DataSource } from 'typeorm';

export const createWinstonLogger = (dataSource: DataSource): winston.Logger => {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new WinstonDbTransport({ dataSource }),
      new winston.transports.Console({
        format: winston.format.simple()
      }),
    ],
  });
};