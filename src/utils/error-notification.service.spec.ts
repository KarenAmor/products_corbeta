import { Test, TestingModule } from '@nestjs/testing';
import { ErrorNotificationService } from './error-notification.service';
import * as nodemailer from 'nodemailer';

// Mock de nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('ErrorNotificationService', () => {
  let service: ErrorNotificationService;
  let transporterMock: {
    sendMail: jest.Mock;
  };

  // Mock de las variables de entorno
  const mockEnv = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'testuser@example.com',
    SMTP_PASSWORD: 'testpassword',
    SMTP_FROM_NAME: 'Test System',
    SMTP_FROM_EMAIL: 'noreply@example.com',
  };

  beforeEach(async () => {
    // Mock del transporter
    transporterMock = {
      sendMail: jest.fn(),
    };

    // Configuramos el mock de createTransport para devolver nuestro transporterMock
    (nodemailer.createTransport as jest.Mock).mockReturnValue(transporterMock);

    // Sobrescribimos process.env directamente
    process.env = { ...process.env, ...mockEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorNotificationService],
    }).compile();

    service = module.get<ErrorNotificationService>(ErrorNotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restauramos process.env a su estado original si es necesario
    // (opcional, dependiendo de si otras pruebas dependen del entorno real)
  });

  describe('constructor', () => {
    it('should initialize transporter with correct SMTP config', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: mockEnv.SMTP_HOST,
        port: Number(mockEnv.SMTP_PORT),
        secure: false,
        auth: {
          user: mockEnv.SMTP_USER,
          pass: mockEnv.SMTP_PASSWORD,
        },
      });
    });
  });

  describe('sendErrorEmail', () => {
    const errorMessage = 'Test error message';

    it('should send email with correct mail options on success', async () => {
      transporterMock.sendMail.mockResolvedValue({ response: 'Email sent' });

      await service.sendErrorEmail(errorMessage);

      expect(transporterMock.sendMail).toHaveBeenCalledWith({
        from: `"${mockEnv.SMTP_FROM_NAME}" <${mockEnv.SMTP_FROM_EMAIL}>`,
        to: mockEnv.SMTP_USER,
        subject: '⚠️ System Error',
        text: `An error has been detected:\n\n${errorMessage}`,
      });
      expect(transporterMock.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should handle error when sending email fails', async () => {
      const sendMailError = new Error('SMTP connection failed');
      transporterMock.sendMail.mockRejectedValue(sendMailError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.sendErrorEmail(errorMessage);

      expect(transporterMock.sendMail).toHaveBeenCalledWith({
        from: `"${mockEnv.SMTP_FROM_NAME}" <${mockEnv.SMTP_FROM_EMAIL}>`,
        to: mockEnv.SMTP_USER,
        subject: '⚠️ System Error',
        text: `An error has been detected:\n\n${errorMessage}`,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending email:', sendMailError);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it('should log success message to console on successful send', async () => {
      transporterMock.sendMail.mockResolvedValue({ response: 'Email sent' });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendErrorEmail(errorMessage);

      expect(consoleLogSpy).toHaveBeenCalledWith('Error email sent.');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      consoleLogSpy.mockRestore();
    });
  });
});