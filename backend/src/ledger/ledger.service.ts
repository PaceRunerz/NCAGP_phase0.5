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
  
  private static readonly GENESIS_HASH =
    '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Ledger service initialized. Chain tip loaded.');
  }

  async record(entry: LedgerEntryInput): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      
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
      if (entry.hashPrev !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          brokenAt: entry.timestamp.toISOString(),
          brokenEntryId: entry.id,
        };
      }

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
