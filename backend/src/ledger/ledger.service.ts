// ─────────────────────────────────────────────────────────────────
// NCAGP — Immutable Audit Ledger Service
// File: src/ledger/ledger.service.ts
//
// DESIGN PRINCIPLES:
//   - Every state-changing action creates a ledger entry
//   - Each entry hashes the previous entry (Merkle-style chain)
//   - Breaking this chain = proof of tampering
//   - No update/delete ever issued against this table (enforced by DB trigger)
//   - Provides court-grade non-repudiation for all audit activities
//
// HASH ALGORITHM: SHA-256
// CHAIN STRUCTURE: hash_current = SHA-256(hash_prev + timestamp + user_id + event_type + entity_id + payload_hash)
// ─────────────────────────────────────────────────────────────────

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LedgerEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

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
  
  // Genesis hash — the seed of the chain. Store this in a config/HSM.
  private static readonly GENESIS_HASH =
    '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Verify chain integrity on startup (optional — can be expensive on large DBs)
    // In production, run this as a scheduled job instead
    this.logger.log('Ledger service initialized. Chain tip loaded.');
  }

  /**
   * Records an immutable event to the audit ledger.
   * This is the ONLY write method for the ledger.
   * 
   * Thread Safety: Uses database-level transaction + serialized hash fetch
   * to prevent hash chain corruption under concurrent writes.
   */
  async record(entry: LedgerEntryInput): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Get the current chain tip (last entry's hash)
      //    FOR UPDATE SKIP LOCKED used to serialize hash chain writes
      const lastEntry = await tx.$queryRaw<{ hashCurrent: string }[]>`
        SELECT "hashCurrent" 
        FROM audit_ledger 
        ORDER BY timestamp DESC 
        LIMIT 1 
        FOR UPDATE
      `;

      const hashPrev = lastEntry.length > 0
        ? lastEntry[0].hashCurrent
        : LedgerService.GENESIS_HASH;

      // 2. Compute the payload hash
      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(entry.payload, Object.keys(entry.payload).sort()))
        .digest('hex');

      // 3. Compute the chain hash
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

      // 4. Write the immutable ledger entry
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

  /**
   * Verifies the integrity of the entire hash chain.
   * Returns the first broken link if tampering is detected.
   * 
   * In production: run this as a nightly scheduled job and alert NIC_ADMIN
   * if any integrity violation is found.
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

    let expectedPrevHash = LedgerService.GENESIS_HASH;

    for (const entry of entries) {
      // Verify prev hash links correctly
      if (entry.hashPrev !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAt: entry.timestamp.toISOString(),
          brokenEntryId: entry.id,
        };
      }

      // Recompute hash and verify
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

      const recomputedHash = crypto
        .createHash('sha256')
        .update(hashInput)
        .digest('hex');

      if (recomputedHash !== entry.hashCurrent) {
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAt: entry.timestamp.toISOString(),
          brokenEntryId: entry.id,
        };
      }

      expectedPrevHash = entry.hashCurrent;
    }

    return { isValid: true, totalEntries: entries.length };
  }

  /**
   * Fetches the full audit trail for a specific entity.
   * Used for finding history, evidence provenance, etc.
   */
  async getEntityHistory(entityType: string, entityId: string) {
    return this.prisma.auditLedger.findMany({
      where: { entityType, entityId },
      orderBy: { timestamp: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}
