// ─────────────────────────────────────────────────────────────────
// NCAGP — Assets Module & Service & Controller
// ─────────────────────────────────────────────────────────────────

// assets.module.ts
import { Module } from '@nestjs/common'; 
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';   
 daq
@Module({
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
