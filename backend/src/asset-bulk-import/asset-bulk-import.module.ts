import { Module } from '@nestjs/common';
import { AssetBulkImportService } from './asset-bulk-import.service';
import { AssetBulkImportController } from './asset-bulk-import.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LedgerModule, PrismaModule],
  providers: [AssetBulkImportService],
  controllers: [AssetBulkImportController],
  exports: [AssetBulkImportService],
})
export class AssetBulkImportModule {}
