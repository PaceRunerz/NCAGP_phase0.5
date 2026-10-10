import { Module } from '@nestjs/common';
import { AssetCertificatesService } from './asset-certificates.service';
import { AssetCertificatesController } from './asset-certificates.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LedgerModule, PrismaModule],
  providers: [AssetCertificatesService],
  controllers: [AssetCertificatesController],
  exports: [AssetCertificatesService],
})
export class AssetCertificatesModule {}
