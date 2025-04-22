import { Test, TestingModule } from '@nestjs/testing';
import { ErrorNotificationService } from '../../utils/error-notification.service';
import * as nodemailer from 'nodemailer';

// Mock de nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

// Mock global de process.env
beforeAll(() => {
  Object.defineProperty(process, 'env', {
    value: {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'testuser@example.com',
      SMTP_PASSWORD: 'testpassword',
      SMTP_FROM_NAME: 'Test System',
      SMTP_FROM_EMAIL: 'noreply@example.com',
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      EMAIL_RECIPIENT: 'testuser@example.com',
    },
    writable: true,
  });
});

describe('ErrorNotificationService', () => {
  let service: ErrorNotificationService;
  let transporterMock: { sendMail: jest.Mock };

  beforeEach(async () => {
    transporterMock = { sendMail: jest.fn() };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(transporterMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorNotificationService],
    }).compile();

    service = module.get<ErrorNotificationService>(ErrorNotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendErrorEmail', () => {
    const errorMessage = 'Test error message';

    it('should send email with correct mail options on success', async () => {
      transporterMock.sendMail.mockResolvedValue({ response: 'Email sent' });

      await service.sendErrorEmail(errorMessage);

      expect(transporterMock.sendMail).toHaveBeenCalledWith({
        from: '"Test System" <noreply@example.com>',
        to: 'testuser@example.com',
        subject: '⚠️ System Error',
        text: `An error has been detected:\n\n${errorMessage}`,
      });
    });

    it('should handle error when sending email fails', async () => {
      const sendMailError = new Error('SMTP connection failed');
      transporterMock.sendMail.mockRejectedValue(sendMailError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.sendErrorEmail(errorMessage);

      expect(transporterMock.sendMail).toHaveBeenCalledWith({
        from: '"Test System" <noreply@example.com>',
        to: 'testuser@example.com',
        subject: '⚠️ System Error',
        text: `An error has been detected:\n\n${errorMessage}`,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending email:', sendMailError);
      consoleErrorSpy.mockRestore();
    });
  });
});