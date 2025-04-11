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

    // Eliminar caracteres especiales, permitiendo solo letras, números, espacios y guiones
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s-]/g, '');

    // Eliminar espacios múltiples y recortar
    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    return cleaned;
  }

  // Método principal del pipe que transforma el valor recibido
  transform(value: any) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Invalid input data');
    }

    // Verificar que el objeto tenga la estructura esperada { products: [...] }
    if (!Array.isArray(value.products)) {
      throw new BadRequestException('Input must contain a "products" array');
    }

    // Crear una copia profunda del objeto para evitar mutar el original
    const cleanedValue = JSON.parse(JSON.stringify(value));

    // Iterar sobre cada producto en el array products
    cleanedValue.products = cleanedValue.products.map((product: any) => {
      const cleanedProduct = { ...product };

      // Limpiar cada campo de tipo string
      for (const key in cleanedProduct) {
        if (typeof cleanedProduct[key] === 'string') {
          cleanedProduct[key] = this.cleanString(cleanedProduct[key]);
        }
      }

      return cleanedProduct;
    });

    return cleanedValue;
  }
}