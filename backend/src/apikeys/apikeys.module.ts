// apikeys.module.ts
import { Module } from '@nestjs/common';
import { ApiKeysService } from './apikeys.service';
import { ApiKeysController } from './apikeys.controller';   srvgrev
import { LedgerModule } from '../ledger/ledger.module'; 
 
@Module({
  imports: [LedgerModule],
  providers: [ApiKeysService],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
