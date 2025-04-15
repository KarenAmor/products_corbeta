import { Test, TestingModule } from '@nestjs/testing';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import * as nodemailer from 'nodemailer';
// Importa herramientas de prueba de NestJS, el servicio a probar y la librería nodemailer para enviar correos.

// Mock de nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));
// Simula el módulo nodemailer reemplazando createTransport con una función mock.

describe('ErrorNotificationService', () => {
  // Define un conjunto de pruebas para el ErrorNotificationService.

  let service: ErrorNotificationService;
  let transporterMock: {
    sendMail: jest.Mock;
  };
  // Declara variables para el servicio y un mock del transporter con una función simulada sendMail.

  // Mock de las variables de entorno
  const mockEnv = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'testuser@example.com',
    SMTP_PASSWORD: 'testpassword',
    SMTP_FROM_NAME: 'Test System',
    SMTP_FROM_EMAIL: 'noreply@example.com',
    SMTP_ENABLED: 'true',
  };
  // Define un objeto con variables de entorno simuladas para la configuración SMTP.

  beforeEach(async () => {
    // Configura el entorno antes de cada prueba.

    // Mock del transporter
    transporterMock = {
      sendMail: jest.fn(),
    };
    // Crea un mock del transporter con una función sendMail simulada.

    // Configuramos el mock de createTransport para devolver nuestro transporterMock
    (nodemailer.createTransport as jest.Mock).mockReturnValue(transporterMock);
    // Configura el mock de nodemailer.createTransport para que devuelva el transporterMock.

    // Sobrescribimos process.env directamente
    process.env = { ...process.env, ...mockEnv };
    // Actualiza las variables de entorno del proceso con las simuladas para esta prueba.

    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorNotificationService],
    }).compile();
    // Crea un módulo de prueba con el ErrorNotificationService como proveedor.

    service = module.get<ErrorNotificationService>(ErrorNotificationService);
    // Obtiene una instancia del ErrorNotificationService para usar en las pruebas.
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Limpia todos los mocks después de cada prueba para evitar interferencias entre ellas.
    // Restauramos process.env a su estado original si es necesario
    // (opcional, dependiendo de si otras pruebas dependen del entorno real)
  });

  describe('constructor', () => {
    // Define pruebas para el constructor del servicio.

    it('should initialize transporter with correct SMTP config', () => {
      // Prueba que verifica si el transporter se inicializa con la configuración SMTP correcta.
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: mockEnv.SMTP_HOST,
        port: Number(mockEnv.SMTP_PORT),
        secure: false,
        auth: {
          user: mockEnv.SMTP_USER,
          pass: mockEnv.SMTP_PASSWORD,
        },
      });
      // Verifica que createTransport fue llamado con los valores esperados de las variables de entorno simuladas.
    });
  });

  describe('sendErrorEmail', () => {
    // Define pruebas para el método sendErrorEmail.

    const errorMessage = 'Test error message';
    // Define un mensaje de error de prueba para usar en las pruebas.

    it('should send email with correct mail options on success', async () => {
      // Prueba que verifica el envío exitoso de un correo con las opciones correctas.
      transporterMock.sendMail.mockResolvedValue({ response: 'Email sent' });
      // Simula que sendMail resuelve con éxito.

      await service.sendErrorEmail(errorMessage);
      // Ejecuta el método sendErrorEmail con el mensaje de error.

      expect(transporterMock.sendMail).toHaveBeenCalledWith({
        from: `"${mockEnv.SMTP_FROM_NAME}" <${mockEnv.SMTP_FROM_EMAIL}>`,
        to: mockEnv.SMTP_USER,
        subject: '⚠️ System Error',
        text: `An error has been detected:\n\n${errorMessage}`,
      });
      // Verifica que sendMail fue llamado con las opciones de correo esperadas.

      expect(transporterMock.sendMail).toHaveBeenCalledTimes(1);
      // Verifica que sendMail fue llamado exactamente una vez.
    });

    it('should handle error when sending email fails', async () => {
      // Prueba que verifica el manejo de errores cuando falla el envío del correo.
      const sendMailError = new Error('SMTP connection failed');
      transporterMock.sendMail.mockRejectedValue(sendMailError);
      // Simula que sendMail falla con un error.

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      // Espía la función console.error para capturar su uso sin mostrarla en la consola.

      await service.sendErrorEmail(errorMessage);
      // Ejecuta el método sendErrorEmail con el mensaje de error.

      expect(transporterMock.sendMail).toHaveBeenCalledWith({
        from: `"${mockEnv.SMTP_FROM_NAME}" <${mockEnv.SMTP_FROM_EMAIL}>`,
        to: mockEnv.SMTP_USER,
        subject: '⚠️ System Error',
        text: `An error has been detected:\n\n${errorMessage}`,
      });
      // Verifica que sendMail fue llamado con las opciones correctas a pesar del fallo.

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending email:', sendMailError);
      // Verifica que se registró el error en la consola.

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      // Verifica que console.error fue llamado exactamente una vez.

      consoleErrorSpy.mockRestore();
      // Restaura console.error a su implementación original.
    });

    it('should log success message to console on successful send', async () => {
      // Prueba que verifica si se registra un mensaje de éxito en la consola tras enviar el correo.
      transporterMock.sendMail.mockResolvedValue({ response: 'Email sent' });
      // Simula que sendMail resuelve con éxito.

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      // Espía la función console.log para capturar su uso sin mostrarla en la consola.

      await service.sendErrorEmail(errorMessage);
      // Ejecuta el método sendErrorEmail con el mensaje de error.

      expect(consoleLogSpy).toHaveBeenCalledWith('Error email sent.');
      // Verifica que se registró el mensaje de éxito en la consola.

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      // Verifica que console.log fue llamado exactamente una vez.

      consoleLogSpy.mockRestore();
      // Restaura console.log a su implementación original.
    });
  });
});