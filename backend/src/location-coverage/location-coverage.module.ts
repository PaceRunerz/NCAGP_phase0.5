import { Module } from '@nestjs/common';
import { LocationCoverageService } from './location-coverage.service';
import { LocationCoverageController } from './location-coverage.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [LocationCoverageService],
  controllers: [LocationCoverageController],
  exports: [LocationCoverageService],
})
export class LocationCoverageModule {}
