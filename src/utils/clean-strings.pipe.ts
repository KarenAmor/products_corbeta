import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class CleanStringsPipe implements PipeTransform {
  // Método para limpiar un string, reemplazando tildes, eñes y símbolos no deseados
 private cleanString(value: string): string {
  if (typeof value !== 'string') return value;

  // Normalizar el string para descomponer caracteres con tildes (e.g., á → a + ´)
  let cleaned = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Reemplazar eñes
  cleaned = cleaned.replace(/ñ/g, 'n').replace(/Ñ/g, 'N');

  // Permitir letras, números, espacios y los caracteres + . / & - _
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s+./&_-]/g, '');

  // Eliminar espacios múltiples y recortar
  cleaned = cleaned.trim().replace(/\s+/g, ' ');

  return cleaned;
}


  // Método para limpiar recursivamente un objeto o arreglo
  private cleanObject(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return typeof value === 'string' ? this.cleanString(value) : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.cleanObject(item));
    }

    const cleaned: { [key: string]: any } = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        cleaned[key] = this.cleanObject(value[key]);
      }
    }

    return cleaned;
  }

  // Método principal del pipe
  transform(value: any) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Invalid input data');
    }

    // Crear una copia profunda y limpiar el objeto recursivamente
    return this.cleanObject(JSON.parse(JSON.stringify(value)));
  }
}