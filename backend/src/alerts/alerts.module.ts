import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AlertsService],
  exports: [AlertsService],   
})
export class AlertsModule {}