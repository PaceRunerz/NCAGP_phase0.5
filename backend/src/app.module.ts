import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule }         from './prisma/prisma.module';
import { AuthModule }           from './auth/auth.module';
import { LedgerModule }         from './ledger/ledger.module';
import { FindingsModule }       from './findings/findings.module';
import { EvidenceModule }       from './evidence/evidence.module';
import { StorageModule }        from './storage/storage.module';
import { OrganizationsModule }  from './organizations/organizations.module';
import { AssetsModule }         from './assets/assets.module';
import { AlertsModule }         from './alerts/alerts.module';
import { ReportsModule }        from './reports/reports.module';
import { ApiKeysModule }        from './apikeys/apikeys.module';
import { IngestModule }         from './ingest/ingest.module';
import { TasksModule }          from './tasks/tasks.module';
import { VendorsModule }        from './vendors/vendors.module';
import { IntelligenceModule }   from './nlq/intelligence.module';
import { RlsInterceptor }       from './rls/rls.interceptor';

// Audits module (inline — small enough)
import { AuditsController }     from './audits/audits.controller';
import { AuditsModule }         from './audits/audits.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    AuthModule,
    LedgerModule,
    OrganizationsModule,
    AssetsModule,
    FindingsModule,
    EvidenceModule,
    AlertsModule,
    ReportsModule,
    ApiKeysModule,
    IngestModule,
    TasksModule,
    VendorsModule,
    AuditsModule,
    IntelligenceModule,
  ],
  providers: [
    { provide: APP_GUARD,       useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RlsInterceptor },
  ],
})
export class AppModule {}
