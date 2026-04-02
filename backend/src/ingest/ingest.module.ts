import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { IngestController } from './ingest.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { ApiKeysModule } from '../apikeys/apikeys.module';

@Module({
  imports: [LedgerModule, ApiKeysModule],
  providers: [IngestService],
  controllers: [IngestController],
})
export class IngestModule {}
