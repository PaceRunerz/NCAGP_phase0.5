import { EvidenceService } from './evidence.service';
import { EvidenceType } from '@prisma/client';
import { Request } from 'express';
export declare class EvidenceController {
    private evidenceService;
    constructor(evidenceService: EvidenceService);
    upload(findingId: string, file: Express.Multer.File, evidenceType: EvidenceType, description: string, clientHash: string, user: any, req: Request): Promise<{
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    } | {
        hashMismatchWarning: string;
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    }>;
    supersede(evidenceId: string, file: Express.Multer.File, reason: string, user: any, req: Request): Promise<{
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    }>;
    verifyIntegrity(evidenceId: string, user: any): Promise<{
        evidenceId: string;
        isIntact: boolean;
        storedHash: string;
        computedHash: string;
        verifiedAt: string;
    }>;
}
