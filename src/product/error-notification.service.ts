import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('SMTP Config:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASSWORD ? '******' : 'No definida', // Ocultar contraseña
});

@Injectable()
export class ErrorNotificationService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, 
      port: Number(process.env.SMTP_PORT), 
      secure: false, 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendErrorEmail(errorMessage: string) {
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: process.env.SMTP_USER, // O el correo del admin
      subject: '⚠️ Error en el Sistema',
      text: `Se ha detectado un error:\n\n${errorMessage}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Correo de error enviado.');
    } catch (error) {
      console.error('Error enviando correo:', error);
    }
  }
}