import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
export declare class FindingsService {
    private prisma;
    private ledger;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: LedgerService);
    create(dto: any): Promise<{
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
    transition(dto: any): Promise<{
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
    findAll(filters: any): Promise<{
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
}
