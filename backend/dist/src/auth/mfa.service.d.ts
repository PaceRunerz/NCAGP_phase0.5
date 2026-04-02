import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
export declare class MfaService {
    private prisma;
    private ledger;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: LedgerService);
    setupMfa(userId: string): Promise<{
        qrCodeDataUrl: string;
        manualEntryKey: string;
        backupCodes: string[];
    }>;
    enableMfa(userId: string, orgId: string, totpCode: string, ipAddress: string): Promise<void>;
    disableMfa(userId: string, orgId: string, totpCode: string, ipAddress: string): Promise<void>;
    getMfaStatus(userId: string): Promise<{
        mfaEnabled: boolean;
        email: string | undefined;
    }>;
}
