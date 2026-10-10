import { Module } from '@nestjs/common';
import { ExpiryRadarService } from './expiry-radar.service';
import { ExpiryRadarController } from './expiry-radar.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ExpiryRadarService],
  controllers: [ExpiryRadarController],
  exports: [ExpiryRadarService],
})
export class ExpiryRadarModule {}
