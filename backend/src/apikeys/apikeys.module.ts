// apikeys.module.ts
import { Module } from '@nestjs/common';
import { ApiKeysService } from './apikeys.service';
import { ApiKeysController } from './apikeys.controller';
import { LedgerModule } from '../ledger/ledger.module'; w

@Module({
  imports: [LedgerModule],
  providers: [ApiKeysService],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
