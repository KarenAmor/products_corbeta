import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductLog } from './entities/productLog.entity';

@Injectable()
export class ProductLogsService {
  constructor(
    @InjectRepository(ProductLog)
    private productLogRepository: Repository<ProductLog>,
  ) {}

  async createLog(reference: string, action: string, oldData?: any, newData?: any) {
    const log = this.productLogRepository.create({
      reference,
      action,
      old_data: oldData,
      new_data: newData,
    });
    return this.productLogRepository.save(log);
  }
}