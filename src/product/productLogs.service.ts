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

  async createLog(
    reference: string,
    action: string,
    oldData?: Record<string, unknown> | null,
    newData?: Record<string, unknown> | null,
  ) {
    const log = this.productLogRepository.create({
      reference,
      action,
      old_data: oldData ?? null,
      new_data: newData ?? null,
    });
    return this.productLogRepository.save(log);
  }
}