import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntelligenceController],
})
export class IntelligenceModule {}
