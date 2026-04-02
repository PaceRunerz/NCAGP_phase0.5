import { OrganizationsService } from './organizations.service';
import { OrgType } from '@prisma/client';
import { Request } from 'express';
declare class CreateOrgDto {
    name: string;
    shortCode: string;
    orgType: OrgType;
    parentOrgId?: string;
    encryptionDomain: string;
}
export declare class OrganizationsController {
    private orgsService;
    constructor(orgsService: OrganizationsService);
    findAll(user: any): Promise<({
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
    create(dto: CreateOrgDto, user: any, req: Request): Promise<{
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
