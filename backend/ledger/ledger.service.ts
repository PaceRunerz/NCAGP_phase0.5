import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LedgerEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { IncidentService, IncidentType, IncidentSeverity } from '../incident/incident.service';

interface LedgerEntryInput {
  userId: string;
  orgId: string;
  eventType: LedgerEventType;
  entityType: string;
  entityId: string;
  payload: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class LedgerService implements OnModuleInit {
  private readonly logger = new Logger(LedgerService.name);
  
  private static readonly GENESIS_HASH =
    '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(
    private prisma: PrismaService,
    private readonly incidentService: IncidentService,
  ) {}

  async onModuleInit() {
    this.logger.log('Ledger service initialized. Chain tip loaded.');
  }

  async record(entry: LedgerEntryInput): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {

      // Serialize every ledger write system-wide. Without this, two
      // record() calls firing close together (very plausible — e.g. two
      // status changes in quick succession) can both read the same "last
      // entry" before either commits, and both then write a hashPrev
      // pointing at the same parent — forking the chain. verifyChain then
      // reports an INTEGRITY VIOLATION on the second of the two entries,
      // even though nothing was actually tampered with. The advisory lock
      // is held for the rest of this transaction and released automatically
      // on commit/rollback, so every record() call becomes fully ordered.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(727274)`;

      const lastEntry = await tx.auditLedger.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { hashCurrent: true }
      });

      const hashPrev = lastEntry 
        ? lastEntry.hashCurrent 
        : LedgerService.GENESIS_HASH;

      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(entry.payload, Object.keys(entry.payload).sort()))
        .digest('hex');

      const timestamp = new Date().toISOString();
      const hashInput = [
        hashPrev,
        timestamp,
        entry.userId,
        entry.orgId,
        entry.eventType,
        entry.entityType,
        entry.entityId,
        payloadHash,
      ].join('|');

      const hashCurrent = crypto
        .createHash('sha256')
        .update(hashInput)
        .digest('hex');

      const ledgerEntry = await tx.auditLedger.create({
        data: {
          userId: entry.userId,
          orgId: entry.orgId,
          eventType: entry.eventType,
          entityType: entry.entityType,
          entityId: entry.entityId,
          payload: entry.payload,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          hashPrev,
          hashCurrent,
          timestamp: new Date(timestamp),
        },
      });

      this.logger.debug(
        `Ledger entry recorded: ${entry.eventType} on ${entry.entityType}:${entry.entityId} | hash: ${hashCurrent.substring(0, 16)}...`,
      );

      return ledgerEntry.id;
    });
  }

  private async reportTampering(entry: { id: string; timestamp: Date }, reason: string) {
    await this.incidentService.report({
      type: IncidentType.LEDGER_TAMPERING,
      severity: IncidentSeverity.CRITICAL,
      title: 'Audit ledger tampering detected',
      description: `Hash chain verification failed at entry ${entry.timestamp.toISOString()}`,
      affectedSystem: 'SYNC — Immutable Audit Ledger',
      detectedAt: new Date(),
      evidence: `verifyChain failed at: ${entry.timestamp.toISOString()} (${reason})`,
      immediateActions: 'Request blocked. Do not proceed with audit ops.',
    });
  }

  /**
   * Verifies the ledger's hash chain by WALKING THE LINKS
   * (hashPrev → hashCurrent), not by trusting `ORDER BY timestamp`.
   *
   * BUG FIX: the previous implementation ordered entries by `timestamp`
   * and assumed that order matched the true write order. It doesn't,
   * reliably — several flows in this codebase write two or more ledger
   * entries within the same request (e.g. marking a checklist control
   * Non-Compliant writes a FINDING_CREATED entry immediately followed by
   * an ASSET_CONTROL_STATUS_CHANGED entry; a finding transition now also
   * triggers an AUDIT_STATUS_CHANGED entry right after FINDING_STATUS_
   * CHANGED). `timestamp` only has millisecond resolution, so entries
   * written microseconds apart can land on the exact same millisecond.
   * SQL does not guarantee a stable sort order for tied values, so on any
   * given verify call, two same-millisecond entries could come back in
   * the wrong order — and the old code would then compare entry B's
   * hashPrev against entry A's hashCurrent (or vice versa) and report a
   * false-positive INTEGRITY VIOLATION on data nobody actually touched.
   *
   * A hash chain's true order is encoded in the links themselves, so this
   * walks from the genesis hash (or, for a date-bounded query, from
   * whatever the first entry in range points at) forward via hashCurrent
   * → hashPrev matching, independent of timestamp ordering entirely.
   */
  async verifyChainIntegrity(
    fromTimestamp?: Date,
    toTimestamp?: Date,
  ): Promise<{
    isValid: boolean;
    totalEntries: number;
    brokenAt?: string;
    brokenEntryId?: string;
  }> {
    const entries = await this.prisma.auditLedger.findMany({
      where: {
        timestamp: {
          gte: fromTimestamp,
          lte: toTimestamp,
        },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        userId: true,
        orgId: true,
        eventType: true,
        entityType: true,
        entityId: true,
        payload: true,
        ipAddress: true,
        timestamp: true,
        hashPrev: true,
        hashCurrent: true,
      },
    });

    if (entries.length === 0) {
      return { isValid: true, totalEntries: 0 };
    }

    // Index entries by their hashPrev — in a genuine, untampered chain
    // there's exactly one entry for any given hashPrev value.
    const byHashPrev = new Map<string, typeof entries>();
    for (const e of entries) {
      const bucket = byHashPrev.get(e.hashPrev);
      if (bucket) bucket.push(e);
      else byHashPrev.set(e.hashPrev, [e]);
    }

    // Full verification (no date range) must start at the true genesis.
    // A date-bounded verification can only vouch for internal consistency
    // of that window — it starts from whatever hashPrev the earliest
    // in-range entry has, since we can't see what came before the window.
    let expectedPrevHash = fromTimestamp ? entries[0].hashPrev : LedgerService.GENESIS_HASH;

    const verifiedIds = new Set<string>();
    let walked = 0;

    while (true) {
      const candidates = (byHashPrev.get(expectedPrevHash) || []).filter(c => !verifiedIds.has(c.id));
      if (candidates.length === 0) break;

      if (candidates.length > 1) {
        // Two entries claiming the same parent — a forked/tampered chain.
        const forkedEntry = candidates[1];
        await this.reportTampering(forkedEntry, 'Forked chain — multiple entries share the same previous hash');
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAt: forkedEntry.timestamp.toISOString(),
          brokenEntryId: forkedEntry.id,
        };
      }

      const entry = candidates[0];

      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(entry.payload, Object.keys(entry.payload as object).sort()))
        .digest('hex');

      const hashInput = [
        entry.hashPrev,
        entry.timestamp.toISOString(),
        entry.userId,
        entry.orgId,
        entry.eventType,
        entry.entityType,
        entry.entityId,
        payloadHash,
      ].join('|');

      const recomputedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      if (recomputedHash !== entry.hashCurrent) {
        await this.reportTampering(entry, 'Recomputed hash mismatch');
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAt: entry.timestamp.toISOString(),
          brokenEntryId: entry.id,
        };
      }

      verifiedIds.add(entry.id);
      walked++;
      expectedPrevHash = entry.hashCurrent;
    }

    if (walked !== entries.length) {
      // Some entries were never reachable from the chain start — orphaned
      // from the main chain, which is itself evidence of tampering.
      const orphan = entries.find(e => !verifiedIds.has(e.id));
      if (orphan) {
        await this.reportTampering(orphan, 'Orphaned entry — not reachable from the chain start');
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAt: orphan.timestamp.toISOString(),
          brokenEntryId: orphan.id,
        };
      }
    }

    return { isValid: true, totalEntries: entries.length };
  }

  /**
   * CRITICAL FIX: this previously took no user context at all — any
   * authenticated role, from any ministry, could pull the ledger
   * history of ANY entity in ANY OTHER ministry just by knowing/
   * guessing its entityId. The controller had no @Roles and no
   * OrgScopeGuard, and this method didn't filter by orgId even though
   * AuditLedger rows carry one. That's a direct breach of the
   * row-level security this system claims to enforce everywhere else
   * (e.g. "MHA CISO can never see MOF data").
   *
   * NIC_ADMIN and REVIEWER keep full cross-ministry visibility (by
   * design — that's their job). Everyone else is now scoped to their
   * own orgId.
   */
  /**
   * CRITICAL FIX: this previously took no user context at all — any
   * authenticated role, from any ministry, could pull the ledger
   * history of ANY entity in ANY OTHER ministry just by knowing/
   * guessing its entityId. The controller had no @Roles and no
   * OrgScopeGuard, and this method did no scoping at all.
   *
   * Important subtlety: a ledger row's own `orgId` field records the
   * ACTOR's org at the time of the event — e.g. when an AUDITOR
   * validates a finding, that row's orgId is the vendor firm's org,
   * not the department's. So naively filtering `where.orgId =
   * requestingUserOrgId` would hide half of a finding's own timeline
   * from the department's own CISO. Instead we resolve who actually
   * OWNS the entity (the department) and, separately, which vendor (if
   * any) is assigned to it, then check the requester against whichever
   * applies to their role.
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    requestingUserOrgId: string,
    requestingUserRole: string,
  ) {
    const fullAccessRoles = ['NIC_ADMIN', 'REVIEWER'];
    if (fullAccessRoles.includes(requestingUserRole)) {
      return this.fetchLedgerRows(entityType, entityId);
    }

    const { ownerOrgId, vendorOrgIds } = await this.resolveEntityOwnership(entityType, entityId);

    const deptRoles = ['DEPT_CISO', 'DEPT_SECURITY'];
    const vendorRoles = ['AUDITOR', 'VENDOR_ADMIN'];

    const allowed =
      (deptRoles.includes(requestingUserRole) && ownerOrgId === requestingUserOrgId) ||
      (vendorRoles.includes(requestingUserRole) && vendorOrgIds.includes(requestingUserOrgId));

    if (!allowed) {
      // Return empty rather than throw — same "you're just not seeing
      // it" pattern used elsewhere in this app for cross-org access
      // rather than confirming to the caller that the entityId exists.
      return [];
    }

    return this.fetchLedgerRows(entityType, entityId);
  }

  private fetchLedgerRows(entityType: string, entityId: string) {
    return this.prisma.auditLedger.findMany({
      where: { entityType, entityId },
      orderBy: { timestamp: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * Resolves the real owning department org + any assigned vendor
   * org(s) for a given entity, independent of who happened to record
   * ledger events against it. Types not explicitly handled fall back
   * to "no owner resolvable" (deny for scoped roles) — safe-by-default
   * rather than accidentally over-granting on a type we didn't map.
   */
  private async resolveEntityOwnership(
    entityType: string,
    entityId: string,
  ): Promise<{ ownerOrgId: string | null; vendorOrgIds: string[] }> {
    switch (entityType) {
      case 'Finding': {
        const finding = await this.prisma.finding.findFirst({
          where: { id: entityId },
          include: { audit: { select: { vendorOrgId: true } } },
        });
        if (!finding) return { ownerOrgId: null, vendorOrgIds: [] };
        return {
          ownerOrgId: finding.orgId,
          vendorOrgIds: finding.audit?.vendorOrgId ? [finding.audit.vendorOrgId] : [],
        };
      }
      case 'Asset': {
        const asset = await this.prisma.asset.findFirst({
          where: { id: entityId },
          include: { auditAssets: { include: { audit: { select: { vendorOrgId: true } } } } },
        });
        if (!asset) return { ownerOrgId: null, vendorOrgIds: [] };
        const vendorOrgIds = Array.from(
          new Set(asset.auditAssets.map((aa) => aa.audit?.vendorOrgId).filter((v): v is string => !!v)),
        );
        return { ownerOrgId: asset.orgId, vendorOrgIds };
      }
      case 'Audit': {
        const audit = await this.prisma.audit.findFirst({ where: { id: entityId } });
        if (!audit) return { ownerOrgId: null, vendorOrgIds: [] };
        return { ownerOrgId: audit.orgId, vendorOrgIds: audit.vendorOrgId ? [audit.vendorOrgId] : [] };
      }
      case 'Evidence': {
        const evidence = await this.prisma.evidence.findFirst({
          where: { id: entityId },
          include: { finding: { include: { audit: { select: { vendorOrgId: true } } } } },
        });
        if (!evidence) return { ownerOrgId: null, vendorOrgIds: [] };
        return {
          ownerOrgId: evidence.finding?.orgId ?? null,
          vendorOrgIds: evidence.finding?.audit?.vendorOrgId ? [evidence.finding.audit.vendorOrgId] : [],
        };
      }
      case 'Building':
      case 'Floor':
      case 'SubLocation':
      case 'Site':
      case 'AssetBatch':
      case 'Policy': {
        // These all carry a direct orgId column on their own table.
        const model = (this.prisma as any)[entityType.charAt(0).toLowerCase() + entityType.slice(1)];
        const row = await model?.findFirst({ where: { id: entityId } });
        return { ownerOrgId: row?.orgId ?? null, vendorOrgIds: [] };
      }
      default:
        return { ownerOrgId: null, vendorOrgIds: [] };
    }
  }
}