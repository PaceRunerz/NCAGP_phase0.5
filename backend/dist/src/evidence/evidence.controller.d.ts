import { EvidenceService } from './evidence.service';
import { EvidenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
declare class SupersedeDto {
    evidenceId: string;
    reason: string;
}
export declare class EvidenceController {
    private evidenceService;
    private prisma;
    constructor(evidenceService: EvidenceService, prisma: PrismaService);
    listEvidence(findingId: string, user: any): Promise<{
        id: string;
        findingId: string;
        evidenceType: import(".prisma/client").$Enums.EvidenceType;
        fileName: string;
        sha256Hash: string;
        fileSize: number;
        mimeType: string;
        description: string | null;
        storageRef: string;
        isSuperseded: boolean;
        supersededById: string | null;
        uploadedBy: {
            id: string;
            name: string;
            email: string;
            role: string;
        };
    }[]>;
    upload(findingId: string, file: Express.Multer.File, evidenceType: EvidenceType, description: string, clientHash: string, user: any, req: Request): Promise<{
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    }>;
    supersede(evidenceId: string, file: Express.Multer.File, dto: SupersedeDto, user: any, req: Request): Promise<{
        id: string;
        sha256Hash: string;
        storageRef: string;
        uploadedAt: Date;
        message: string;
    }>;
    verify(evidenceId: string, user: any): Promise<{
        evidenceId: string;
        isIntact: boolean;
        storedHash: string;
        computedHash: string;
        verifiedAt: string;
    }>;
}
export {};
