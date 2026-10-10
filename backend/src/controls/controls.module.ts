import { Module } from '@nestjs/common';
import { ControlsController } from './controls.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ControlsController],
})
export class ControlsModule {}
