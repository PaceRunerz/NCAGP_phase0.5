import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { OrgType } from '@prisma/client';
interface CreateOrgDto {
    name: string;
    shortCode: string;
    orgType: OrgType;
    parentOrgId?: string;
    encryptionDomain: string;
    createdById: string;
    ipAddress: string;
}
export declare class OrganizationsService {
    private prisma;
    private ledger;
    constructor(prisma: PrismaService, ledger: LedgerService);
    create(dto: CreateOrgDto): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        shortCode: string;
        orgType: import(".prisma/client").$Enums.OrgType;
        parentOrgId: string | null;
        encryptionDomain: string;
        dataAccessScope: string[];
    }>;
    findAll(requesterRole: string): Promise<({
        _count: {
            findings: number;
            users: number;
            assets: number;
        };
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        shortCode: string;
        orgType: import(".prisma/client").$Enums.OrgType;
        parentOrgId: string | null;
        encryptionDomain: string;
        dataAccessScope: string[];
    })[]>;
    findOne(id: string): Promise<{
        _count: {
            findings: number;
            assets: number;
        };
        users: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
            isActive: boolean;
        }[];
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        shortCode: string;
        orgType: import(".prisma/client").$Enums.OrgType;
        parentOrgId: string | null;
        encryptionDomain: string;
        dataAccessScope: string[];
    }>;
}
export {};
