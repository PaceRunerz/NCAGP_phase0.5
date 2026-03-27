import { AssetsService } from './assets.service';
import { AssetType } from '@prisma/client';
declare class CreateAssetDto {
    orgId: string;
    assetType: AssetType;
    name: string;
    description?: string;
    ownerUserId?: string;
    businessUnit: string;
    criticality: number;
    dataSensitivity: string;
    environment: string;
    ipAddress?: string;
    hostname?: string;
    tags?: string[];
}
export declare class AssetsController {
    private assetsService;
    constructor(assetsService: AssetsService);
    findAll(orgId: string, user: any): Promise<({
        _count: {
            findings: number;
        };
    } & {
        id: string;
        orgId: string;
        ipAddress: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.AssetStatus;
        description: string | null;
        assetType: import(".prisma/client").$Enums.AssetType;
        ownerUserId: string | null;
        businessUnit: string;
        criticality: number;
        dataSensitivity: string;
        environment: string;
        locationRegion: string;
        hostname: string | null;
        dependencies: string[];
        tags: string[];
    })[]>;
    findOne(id: string, user: any): Promise<{
        findings: {
            id: string;
            title: string;
            status: import(".prisma/client").$Enums.FindingStatus;
            severity: import(".prisma/client").$Enums.Severity;
        }[];
    } & {
        id: string;
        orgId: string;
        ipAddress: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.AssetStatus;
        description: string | null;
        assetType: import(".prisma/client").$Enums.AssetType;
        ownerUserId: string | null;
        businessUnit: string;
        criticality: number;
        dataSensitivity: string;
        environment: string;
        locationRegion: string;
        hostname: string | null;
        dependencies: string[];
        tags: string[];
    }>;
    create(dto: CreateAssetDto): Promise<{
        id: string;
        orgId: string;
        ipAddress: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.AssetStatus;
        description: string | null;
        assetType: import(".prisma/client").$Enums.AssetType;
        ownerUserId: string | null;
        businessUnit: string;
        criticality: number;
        dataSensitivity: string;
        environment: string;
        locationRegion: string;
        hostname: string | null;
        dependencies: string[];
        tags: string[];
    }>;
}
export {};
