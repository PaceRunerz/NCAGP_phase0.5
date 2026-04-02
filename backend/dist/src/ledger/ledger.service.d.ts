import { OnModuleInit } from '@nestjs/common';
import { LedgerEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
export declare class LedgerService implements OnModuleInit {
    private prisma;
    private readonly logger;
    private static readonly GENESIS_HASH;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    record(entry: LedgerEntryInput): Promise<string>;
    verifyChainIntegrity(fromTimestamp?: Date, toTimestamp?: Date): Promise<{
        isValid: boolean;
        totalEntries: number;
        brokenAt?: string;
        brokenEntryId?: string;
    }>;
    getEntityHistory(entityType: string, entityId: string): Promise<({
        user: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        id: string;
        orgId: string;
        eventType: import(".prisma/client").$Enums.LedgerEventType;
        entityType: string;
        entityId: string;
        payload: import("@prisma/client/runtime/library").JsonValue;
        ipAddress: string;
        userAgent: string | null;
        hashPrev: string;
        hashCurrent: string;
        timestamp: Date;
        userId: string;
    })[]>;
}
export {};
