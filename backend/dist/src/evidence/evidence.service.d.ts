import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { StorageService } from '../storage/storage.service';
import { EvidenceType } from '@prisma/client';
interface UploadEvidenceDto {
    findingId: string;
    evidenceType: EvidenceType;
    description?: string;
    file: {
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
    };
    uploadedById: string;
    orgId: string;
    ipAddress: string;
    userAgent?: string;
}
interface SupersedeEvidenceDto {
    evidenceId: string;
    reason: string;
    newFile: UploadEvidenceDto['file'];
    requestedById: string;
    orgId: string;
    ipAddress: string;
}
export declare class EvidenceService {
    private prisma;
    private ledger;
    private storage;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: LedgerService, storage: StorageService);
    upload(dto: UploadEvidenceDto): Promise<{
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    }>;
    supersede(dto: SupersedeEvidenceDto): Promise<{
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    }>;
    verifyIntegrity(evidenceId: string, orgId: string): Promise<{
        evidenceId: string;
        isIntact: boolean;
        storedHash: string;
        computedHash: string;
        verifiedAt: string;
    }>;
}
export {};
