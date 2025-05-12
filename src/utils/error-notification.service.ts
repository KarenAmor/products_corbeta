import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
// Importa el decorador Injectable de NestJS para definir un servicio inyectable, 
// nodemailer para enviar correos electrónicos y dotenv para cargar variables de entorno desde un archivo .env.

dotenv.config();
// Carga las variables de entorno definidas en un archivo .env al objeto process.env.

@Injectable()
// Marca esta clase como un servicio que puede ser inyectado en otros componentes de NestJS.

export class ErrorNotificationService {
  private transporter;
  private readonly enabled: boolean;
  // Declara una propiedad privada para almacenar el objeto transporter de nodemailer.

  constructor() {
    this.enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
    // Define el constructor que se ejecuta al instanciar el servicio.
    if (this.enabled) {
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
    // Inicializa el transporter usando nodemailer.createTransport con la configuración SMTP obtenida de las variables de entorno:
    // - host: dirección del servidor SMTP.
    // - port: puerto del servidor SMTP, convertido a número desde string.
    // - secure: false indica que no usa SSL/TLS (probablemente usa STARTTLS en su lugar).
    // - auth: objeto con el usuario y contraseña para autenticarse en el servidor SMTP.
  }

  async sendErrorEmail(errorMessage: string) {
    if (!this.enabled) {
      return;
    }
    // Define un método asíncrono para enviar un correo de notificación de errores, que recibe un mensaje de error como parámetro.

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: process.env.EMAIL_RECIPIENT, 
      subject: '⚠️ Error sincronizador de bajada corbemovil',
      text: `Se ha detectado un error:\n\n${errorMessage}`,
    };
    // Define las opciones del correo:
    // - from: remitente con nombre y dirección de correo obtenidos de las variables de entorno.
    // - to: destinatario, configurado como el mismo usuario SMTP (probablemente el administrador).
    // - subject: asunto del correo con un emoji de advertencia.
    // - text: cuerpo del correo con el mensaje de error precedido por un texto descriptivo.

    try {
      await this.transporter.sendMail(mailOptions);
      // Intenta enviar el correo usando el transporter con las opciones definidas.
      // Si el envío es exitoso, registra un mensaje en la consola indicando que el correo fue enviado.
    } catch (error) {
      console.error('Error sending email:', error);
      // Si ocurre un error durante el envío, lo captura y lo registra en la consola con el mensaje de error.
    }
  }
}