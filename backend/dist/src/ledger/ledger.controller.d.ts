import { LedgerService } from './ledger.service';
declare class VerifyChainDto {
    fromTimestamp?: string;
    toTimestamp?: string;
}
export declare class LedgerController {
    private ledger;
    constructor(ledger: LedgerService);
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
    verifyChain(dto: VerifyChainDto): Promise<{
        isValid: boolean;
        totalEntries: number;
        brokenAt?: string;
        brokenEntryId?: string;
    }>;
}
export {};
