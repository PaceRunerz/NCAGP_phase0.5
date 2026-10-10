// backend/src/incident/incident.module.ts
import { Module } from '@nestjs/common';
import { IncidentService } from './incident.service';

@Module({
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE IncidentService in other modules
// ─────────────────────────────────────────────────────────────────────────────

/*
// 1. Import IncidentModule into any module that needs it:
//    e.g. auth.module.ts, ledger.module.ts, rls.module.ts

import { IncidentModule } from '../incident/incident.module';

@Module({
  imports: [IncidentModule, ...],
})
export class AuthModule {}

// 2. Inject and call in auth.service.ts — on account lockout:

constructor(
  private readonly incidentService: IncidentService,
  ...
) {}

// When account gets locked after 5 failures:
await this.incidentService.checkAndReport('failed_logins', {
  count: failedAttempts,
  userId: user.id,
  orgId: user.orgId,
  sourceIp: ipAddress,
  details: `Account ${user.email} locked after ${failedAttempts} consecutive failures`,
});

// 3. In rls.interceptor.ts — on RLS violation:
await this.incidentService.report({
  type: IncidentType.RLS_BYPASS_DETECTED,
  severity: IncidentSeverity.CRITICAL,
  title: 'Cross-tenant data access attempt detected',
  description: `User ${userId} from org ${userOrgId} attempted to access data from org ${targetOrgId}`,
  affectedSystem: 'SYNC — PostgreSQL RLS Layer',
  detectedAt: new Date(),
  userId,
  orgId: userOrgId,
  sourceIp: request.ip,
  evidence: `Requested resource orgId: ${targetOrgId}, User orgId: ${userOrgId}`,
  immediateActions: 'Request blocked by RLS interceptor. Session flagged for review.',
});

// 4. In ledger.service.ts — on tamper detection:
await this.incidentService.report({
  type: IncidentType.LEDGER_TAMPERING,
  severity: IncidentSeverity.CRITICAL,
  title: 'Audit ledger tampering detected',
  description: `Hash chain verification failed at entry ${tamperDetectedAt}`,
  affectedSystem: 'SYNC — Immutable Audit Ledger',
  detectedAt: new Date(),
  orgId,
  evidence: `verifyChain result: ${JSON.stringify(verifyResult)}`,
  immediateActions: 'System has raised alert. Do not proceed with audit operations until investigation complete.',
});
*/
