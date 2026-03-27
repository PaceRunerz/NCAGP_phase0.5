// ─────────────────────────────────────────────────────────────────
// NCAGP — Root Application Module
// File: src/app.module.ts
// ─────────────────────────────────────────────────────────────────

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { FindingsModule } from './findings/findings.module';
import { EvidenceModule } from './evidence/evidence.module';
import { StorageModule } from './storage/storage.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AssetsModule } from './assets/assets.module';
import { RlsInterceptor } from './rls/rls.interceptor';

@Module({
  imports: [
    // Config — loads .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting — 100 requests per minute per IP
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 100 },
    ]),

    // Core modules
    PrismaModule,
    StorageModule,
    AuthModule,
    LedgerModule,

    // Domain modules
    OrganizationsModule,
    AssetsModule,
    FindingsModule,
    EvidenceModule,
  ],
  providers: [
    // Global rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global RLS interceptor — sets Postgres session vars per request
    { provide: APP_INTERCEPTOR, useClass: RlsInterceptor },
  ],
})
export class AppModule {}
