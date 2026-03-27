import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FindingStatus, Severity, UserRole } from '@prisma/client';
interface CreateFindingDto {
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
    createdById: string;
    ipAddress: string;
}
interface TransitionFindingDto {
    findingId: string;
    newStatus: FindingStatus;
    comment?: string;
    closureJustification?: string;
    requestedById: string;
    requestedByRole: UserRole;
    orgId: string;
    ipAddress: string;
}
export declare class FindingsService {
    private prisma;
    private ledger;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: LedgerService);
    create(dto: CreateFindingDto): Promise<{
        id: string;
        orgId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.FindingStatus;
        closedAt: Date | null;
        auditId: string;
        assetId: string | null;
        controlId: string | null;
        severity: import(".prisma/client").$Enums.Severity;
        description: string;
        rootCause: string | null;
        recommendation: string | null;
        technicalDetail: string | null;
        ownerId: string | null;
        slaDate: Date | null;
        slaBreached: boolean;
        closureJustification: string | null;
        riskAcceptedBy: string | null;
        riskAcceptedAt: Date | null;
        isRecurring: boolean;
        previousFindingId: string | null;
    }>;
    transition(dto: TransitionFindingDto): Promise<{
        id: string;
        orgId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import(".prisma/client").$Enums.FindingStatus;
        closedAt: Date | null;
        auditId: string;
        assetId: string | null;
        controlId: string | null;
        severity: import(".prisma/client").$Enums.Severity;
        description: string;
        rootCause: string | null;
        recommendation: string | null;
        technicalDetail: string | null;
        ownerId: string | null;
        slaDate: Date | null;
        slaBreached: boolean;
        closureJustification: string | null;
        riskAcceptedBy: string | null;
        riskAcceptedAt: Date | null;
        isRecurring: boolean;
        previousFindingId: string | null;
    }>;
    findAll(filters: {
        orgId?: string;
        requestingUserId: string;
        requestingUserRole: UserRole;
        requestingUserOrgId: string;
        requestingUserDataScope: string[];
        severity?: Severity;
        status?: FindingStatus;
        auditId?: string;
        page?: number | string;
        limit?: number | string;
    }): Promise<{
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
            title: string;
            status: import(".prisma/client").$Enums.FindingStatus;
            closedAt: Date | null;
            auditId: string;
            assetId: string | null;
            controlId: string | null;
            severity: import(".prisma/client").$Enums.Severity;
            description: string;
            rootCause: string | null;
            recommendation: string | null;
            technicalDetail: string | null;
            ownerId: string | null;
            slaDate: Date | null;
            slaBreached: boolean;
            closureJustification: string | null;
            riskAcceptedBy: string | null;
            riskAcceptedAt: Date | null;
            isRecurring: boolean;
            previousFindingId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    getRiskHeatmap(): Promise<{
        orgId: string;
        orgName: string;
        shortCode: string;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        openCount: number;
        slaBreachedCount: number;
        riskScore: number;
    }[]>;
}
export {};
