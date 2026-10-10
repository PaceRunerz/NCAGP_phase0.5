import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorScoringService } from './vendor-scoring.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [VendorScoringService],
  controllers: [VendorsController],
  exports: [VendorScoringService],
})
export class VendorsModule {}
