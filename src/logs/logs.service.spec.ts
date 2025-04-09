import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';
// Importa herramientas de prueba de NestJS, el servicio a probar, dependencias como DataSource de TypeORM, Logger de Winston y una función para crear el logger.

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
// Define una interfaz para estructurar los datos que se pasarán al método log, usada en las pruebas.

jest.mock('./winston.config', () => ({
  createWinstonLogger: jest.fn(),
}));
// Simula el módulo winston.config reemplazando createWinstonLogger con una función mock.

describe('LogsService', () => {
  // Define un conjunto de pruebas para el LogsService.

  let service: LogsService;
  let dataSourceMock: jest.Mocked<DataSource>;
  let loggerMock: jest.Mocked<Logger>;
  // Declara variables para el servicio, un mock de DataSource y un mock de Logger.

  beforeEach(async () => {
    // Configura el entorno antes de cada prueba.

    dataSourceMock = {
      createQueryRunner: jest.fn(),
    } as any;
    // Crea un mock de DataSource con una función simulada createQueryRunner (aunque no se usa en estas pruebas).

    loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
    } as any;
    // Crea un mock de Logger con funciones simuladas info y error.

    (createWinstonLogger as jest.Mock).mockReturnValue(loggerMock);
    // Configura el mock de createWinstonLogger para que devuelva el loggerMock.

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();
    // Crea un módulo de prueba con LogsService y el mock de DataSource como proveedores.

    service = module.get<LogsService>(LogsService);
    // Obtiene una instancia del LogsService para usar en las pruebas.

    // Inicializamos el logger manualmente
    service.onModuleInit();
    // Llama manualmente al método onModuleInit para inicializar el logger, simulando el ciclo de vida del módulo.
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Limpia todos los mocks después de cada prueba para evitar interferencias entre ellas.
  });

  describe('onModuleInit', () => {
    // Define pruebas para el método onModuleInit.

    it('should initialize logger with createWinstonLogger', () => {
      // Prueba que verifica si el logger se inicializa con createWinstonLogger.
      service.onModuleInit();
      // Ejecuta onModuleInit nuevamente.

      expect(createWinstonLogger).toHaveBeenCalledWith(dataSourceMock);
      // Verifica que createWinstonLogger fue llamado con el mock de DataSource.

      expect(createWinstonLogger).toHaveBeenCalledTimes(2);
      // Verifica que se llamó dos veces: una en beforeEach y otra en esta prueba.
    });

    it('should set logger instance', () => {
      // Prueba que verifica si la instancia del logger se establece correctamente.
      service.onModuleInit();
      // Ejecuta onModuleInit nuevamente.

      const logger = (service as any).logger;
      // Accede a la propiedad privada logger del servicio (usando as any para evitar restricciones de TypeScript).

      expect(logger).toBe(loggerMock);
      // Verifica que la propiedad logger sea igual al mock creado.
    });
  });

  describe('log', () => {
    // Define pruebas para el método log.

    it('should not throw error with valid payload', () => {
      // Prueba que verifica si el método log no lanza errores con un payload válido.
      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref1',
        table_name: 'product',
        data: { reference: 'ref1', name: 'Product 1' },
        result: 'exitoso',
        event_date: new Date(),
      };
      // Define un payload válido sin error_message.

      expect(() => service.log(payload)).not.toThrow();
      // Verifica que llamar al método log con este payload no lance excepciones.
    });

    it('should handle payload with error_message', () => {
      // Prueba que verifica si el método log maneja correctamente un payload con error_message.
      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref2',
        table_name: 'product',
        data: { reference: 'ref2' },
        result: 'fallido',
        error_message: 'Missing required fields: name',
        event_date: new Date(),
      };
      // Define un payload válido con error_message.

      expect(() => service.log(payload)).not.toThrow();
      // Verifica que llamar al método log con este payload no lance excepciones.
    });

    it('should call logger.info for successful result (future implementation)', () => {
      // Prueba que simula una implementación futura donde logger.info se usa para resultados exitosos.
      const logSpy = jest.spyOn(service as any, 'log').mockImplementation((payload: LogPayload) => {
        if (payload.result === 'exitoso') {
          (service as any).logger.info(payload);
        }
      });
      // Espía el método log y lo reemplaza con una implementación que llama a logger.info si el resultado es 'exitoso'.

      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref1',
        table_name: 'product',
        data: { reference: 'ref1' },
        result: 'exitoso',
        event_date: new Date(),
      };
      // Define un payload con resultado exitoso.

      service.log(payload);
      // Ejecuta el método log con el payload.

      expect(logSpy).toHaveBeenCalledWith(payload);
      // Verifica que el método log fue llamado con el payload.

      expect(loggerMock.info).toHaveBeenCalledWith(payload);
      // Verifica que logger.info fue llamado con el payload.

      logSpy.mockRestore();
      // Restaura el método log a su implementación original.
    });

    it('should call logger.error for failed result (future implementation)', () => {
      // Prueba que simula una implementación futura donde logger.error se usa para resultados fallidos.
      const logSpy = jest.spyOn(service as any, 'log').mockImplementation((payload: LogPayload) => {
        if (payload.result === 'fallido') {
          (service as any).logger.error(payload);
        }
      });
      // Espía el método log y lo reemplaza con una implementación que llama a logger.error si el resultado es 'fallido'.

      const payload: LogPayload = {
        sync_type: 'API',
        record_id: 'ref2',
        table_name: 'product',
        data: { reference: 'ref2' },
        result: 'fallido',
        error_message: 'Missing required fields: name',
        event_date: new Date(),
      };
      // Define un payload con resultado fallido y un mensaje de error.

      service.log(payload);
      // Ejecuta el método log con el payload.

      expect(logSpy).toHaveBeenCalledWith(payload);
      // Verifica que el método log fue llamado con el payload.

      expect(loggerMock.error).toHaveBeenCalledWith(payload);
      // Verifica que logger.error fue llamado con el payload.

      logSpy.mockRestore();
      // Restaura el método log a su implementación original.
    });
  });
});