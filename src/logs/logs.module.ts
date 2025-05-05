import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogEntity } from './entities/log.entity';
 
@Module({
  imports: [TypeOrmModule.forFeature([LogEntity], 'corbemovilTempConnection')],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}