import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ProductPrice } from './entities/product-price.entity';
import { Catalog } from '../catalog/entities/catalog.entity';
import { City } from '../catalog/entities/city.entity';
import { ProductPriceOperationDto } from './dto/create-product-price.dto';

@Injectable()
export class ProductPricesService {
  constructor(
    @InjectRepository(ProductPrice)
    private readonly productPriceRepository: Repository<ProductPrice>,
    @InjectRepository(Catalog)
    private readonly catalogRepository: Repository<Catalog>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly configService: ConfigService,
  ) {}

  async processOperation(operation: ProductPriceOperationDto): Promise<ProductPrice | null> {
    // Leer DELETE_RECORD desde las variables de entorno
    const DELETE_RECORD = this.configService.get<boolean>('DELETE_RECORD', true);

    // Validar que los campos requeridos estén presentes
    if (
      !operation.business_unit ||
      !operation.catalog ||
      !operation.product_reference ||
      operation.price === undefined ||
      operation.vlr_impu_consumo === undefined ||
      operation.is_active === undefined
    ) {
      throw new BadRequestException('All fields (business_unit, catalog, product_reference, price, vlr_impu_consumo, is_active) are required');
    }

    // Buscar la ciudad por business_unit (que en la entidad City es el campo 'name')
    const city = await this.cityRepository.findOne({
      where: { name: operation.business_unit },
    });

    if (!city) {
      throw new NotFoundException(`City not found for business_unit ${operation.business_unit}`);
    }

    // Buscar el catálogo por catalog (que en la entidad Catalog es el campo 'name') y la ciudad encontrada
    const catalog = await this.catalogRepository.findOne({
      where: { name: operation.catalog, city_id: city.id },
    });

    if (!catalog) {
      throw new NotFoundException(
        `Catalog not found for business_unit ${operation.business_unit} and catalog ${operation.catalog}`,
      );
    }

    const catalog_id = catalog.id;

    // Verificar si el registro ya existe
    const existingPrice = await this.productPriceRepository.findOne({
      where: { catalog_id, product_reference: operation.product_reference },
    });

    // Mapear los datos del DTO a la entidad
    const productPriceData = {
      catalog_id,
      product_reference: operation.product_reference,
      price: operation.price,
      vlr_impu_consumo: operation.vlr_impu_consumo,
      is_active: operation.is_active,
    };

    // Decidir la acción según las reglas
    if (!existingPrice) {
      // Si no existe, crear el registro
      const productPrice = this.productPriceRepository.create(productPriceData);
      return this.productPriceRepository.save(productPrice);
    } else {
      // Si existe, actualizar o eliminar según is_active y DELETE_RECORD
      if (operation.is_active === 0 && DELETE_RECORD) {
        // Eliminar el registro
        await this.productPriceRepository.remove(existingPrice);
        return null; // Indicamos que se eliminó el registro
      } else {
        // Actualizar el registro (ya sea con is_active=1 o is_active=0 si DELETE_RECORD=false)
        Object.assign(existingPrice, productPriceData);
        return this.productPriceRepository.save(existingPrice);
      }
    }
  }

  async findAll(): Promise<ProductPrice[]> {
    return this.productPriceRepository.find();
  }
}