import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

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
      to: process.env.SMTP_USER, 
      subject: '⚠️ System Error',
      text: `An error has been detected:\n\n${errorMessage}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Error email sent.');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
}