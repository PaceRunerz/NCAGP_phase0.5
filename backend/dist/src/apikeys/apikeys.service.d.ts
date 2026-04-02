import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
interface CreateApiKeyDto {
    name: string;
    scopes: string[];
    orgId: string;
    createdById: string;
    expiresInDays?: number;
    ipAddress: string;
}
export declare class ApiKeysService {
    private prisma;
    private ledger;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: LedgerService);
    create(dto: CreateApiKeyDto): Promise<any>;
    list(orgId: string): Promise<any[]>;
    revoke(keyId: string, orgId: string, revokedBy: string, ipAddress: string): Promise<{
        message: string;
    }>;
    validateKey(rawKey: string): Promise<{
        orgId: string;
        scopes: string[];
    } | null>;
}
export {};
