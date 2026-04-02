import { FindingsService } from './findings.service';
import { Severity, FindingStatus } from '@prisma/client';
import { Request } from 'express';
declare class CreateFindingDto {
    auditId: string;
    orgId: string;
    assetId?: string;
    controlId?: string;
    severity: Severity;
    title: string;
    description: string;
    rootCause?: string;
    recommendation?: string;
    technicalDetail?: string;
}
declare class TransitionFindingDto {
    newStatus: FindingStatus;
    comment?: string;
    closureJustification?: string;
}
export declare class FindingsController {
    private findingsService;
    constructor(findingsService: FindingsService);
    getRiskHeatmap(): Promise<{
        orgId: any;
        orgName: any;
        shortCode: any;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        openCount: number;
        slaBreachedCount: number;
        riskScore: number;
    }[]>;
    findAll(user: any, orgId?: string, severity?: Severity, status?: FindingStatus, auditId?: string, page?: number, limit?: number): Promise<{
        findings: ({
            asset: {
                id: string;
                name: string;
                criticality: number;
            } | null;
            control: {
                id: string;
                name: string;
                controlCode: string;
            } | null;
            org: {
                id: string;
                name: string;
                shortCode: string;
            };
            _count: {
                evidence: number;
                tasks: number;
            };
        } & {
            id: string;
            orgId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.FindingStatus;
            severity: import(".prisma/client").$Enums.Severity;
            title: string;
            description: string;
            rootCause: string | null;
            recommendation: string | null;
            technicalDetail: string | null;
            slaDate: Date | null;
            slaBreached: boolean;
            closedAt: Date | null;
            closureJustification: string | null;
            riskAcceptedBy: string | null;
            riskAcceptedAt: Date | null;
            isRecurring: boolean;
            previousFindingId: string | null;
            auditId: string;
            assetId: string | null;
            controlId: string | null;
            ownerId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    create(dto: CreateFindingDto, user: any, req: Request): Promise<{
        id: string;
        orgId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.FindingStatus;
        severity: import(".prisma/client").$Enums.Severity;
        title: string;
        description: string;
        rootCause: string | null;
        recommendation: string | null;
        technicalDetail: string | null;
        slaDate: Date | null;
        slaBreached: boolean;
        closedAt: Date | null;
        closureJustification: string | null;
        riskAcceptedBy: string | null;
        riskAcceptedAt: Date | null;
        isRecurring: boolean;
        previousFindingId: string | null;
        auditId: string;
        assetId: string | null;
        controlId: string | null;
        ownerId: string | null;
    }>;
    getHistory(id: string, user: any): Promise<{
        findings: ({
            asset: {
                id: string;
                name: string;
                criticality: number;
            } | null;
            control: {
                id: string;
                name: string;
                controlCode: string;
            } | null;
            org: {
                id: string;
                name: string;
                shortCode: string;
            };
            _count: {
                evidence: number;
                tasks: number;
            };
        } & {
            id: string;
            orgId: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.FindingStatus;
            severity: import(".prisma/client").$Enums.Severity;
            title: string;
            description: string;
            rootCause: string | null;
            recommendation: string | null;
            technicalDetail: string | null;
            slaDate: Date | null;
            slaBreached: boolean;
            closedAt: Date | null;
            closureJustification: string | null;
            riskAcceptedBy: string | null;
            riskAcceptedAt: Date | null;
            isRecurring: boolean;
            previousFindingId: string | null;
            auditId: string;
            assetId: string | null;
            controlId: string | null;
            ownerId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    transition(findingId: string, dto: TransitionFindingDto, user: any, req: Request): Promise<{
        id: string;
        orgId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.FindingStatus;
        severity: import(".prisma/client").$Enums.Severity;
        title: string;
        description: string;
        rootCause: string | null;
        recommendation: string | null;
        technicalDetail: string | null;
        slaDate: Date | null;
        slaBreached: boolean;
        closedAt: Date | null;
        closureJustification: string | null;
        riskAcceptedBy: string | null;
        riskAcceptedAt: Date | null;
        isRecurring: boolean;
        previousFindingId: string | null;
        auditId: string;
        assetId: string | null;
        controlId: string | null;
        ownerId: string | null;
    }>;
}
export {};
