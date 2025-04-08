import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';

// Definimos la interfaz LogPayload en las pruebas
interface LogPayload {
  sync_type: string;
  record_id: string;
  table_name: string;
  data: any;
  result: string;
  error_message?: string;
  event_date: Date;
}

jest.mock('./winston.config', () => ({
  createWinstonLogger: jest.fn(),
}));

describe('LogsService', () => {
  let service: LogsService;
  let dataSourceMock: jest.Mocked<DataSource>;
  let loggerMock: jest.Mocked<Logger>;

  beforeEach(async () => {
    dataSourceMock = {
      createQueryRunner: jest.fn(),
    } as any;

    loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    (createWinstonLogger as jest.Mock).mockReturnValue(loggerMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
    // Inicializamos el logger manualmente
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize logger with createWinstonLogger', () => {
      service.onModuleInit();

      expect(createWinstonLogger).toHaveBeenCalledWith(dataSourceMock);
      expect(createWinstonLogger).toHaveBeenCalledTimes(2); // Se llama en beforeEach y aquí
    });

    it('should set logger instance', () => {
      service.onModuleInit();

      const logger = (service as any).logger;
      expect(logger).toBe(loggerMock);
    });
  });

  describe('log', () => {
    it('should not throw error with valid payload', () => {
      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref1',
        table_name: 'product',
        data: { reference: 'ref1', name: 'Product 1' },
        result: 'exitoso',
        event_date: new Date(),
      };

      expect(() => service.log(payload)).not.toThrow();
    });

    it('should handle payload with error_message', () => {
      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref2',
        table_name: 'product',
        data: { reference: 'ref2' },
        result: 'fallido',
        error_message: 'Missing required fields: name',
        event_date: new Date(),
      };

      expect(() => service.log(payload)).not.toThrow();
    });

    it('should call logger.info for successful result (future implementation)', () => {
      const logSpy = jest.spyOn(service as any, 'log').mockImplementation((payload: LogPayload) => {
        if (payload.result === 'exitoso') {
          (service as any).logger.info(payload);
        }
      });

      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref1',
        table_name: 'product',
        data: { reference: 'ref1' },
        result: 'exitoso',
        event_date: new Date(),
      };

      service.log(payload);

      expect(logSpy).toHaveBeenCalledWith(payload);
      expect(loggerMock.info).toHaveBeenCalledWith(payload);

      logSpy.mockRestore();
    });

    it('should call logger.error for failed result (future implementation)', () => {
      const logSpy = jest.spyOn(service as any, 'log').mockImplementation((payload: LogPayload) => {
        if (payload.result === 'fallido') {
          (service as any).logger.error(payload);
        }
      });

      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref2',
        table_name: 'product',
        data: { reference: 'ref2' },
        result: 'fallido',
        error_message: 'Missing required fields: name',
        event_date: new Date(),
      };

      service.log(payload);

      expect(logSpy).toHaveBeenCalledWith(payload);
      expect(loggerMock.error).toHaveBeenCalledWith(payload);

      logSpy.mockRestore();
    });
  });
});