import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
export interface ScannerPayload {
    audit_id: string;
    severity: string;
    title: string;
    description: string;
    asset_id?: string;
    control_id?: string;
    root_cause?: string;
    recommendation?: string;
    technical_detail?: string;
    plugin_id?: string;
    plugin_name?: string;
    host?: string;
    port?: string;
    protocol?: string;
    solution?: string;
    synopsis?: string;
    cvss_score?: number;
    cve?: string[];
    cwe?: string[];
    rule_key?: string;
    component?: string;
    message?: string;
    oid?: string;
    nvt_name?: string;
    threat?: string;
}
export interface IngestResult {
    findingId: string;
    ledgerEntryId: string;
    severity: string;
    slaDate: string;
    isDuplicate: boolean;
    message: string;
}
export declare class IngestService {
    private prisma;
    private ledger;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: LedgerService);
    ingestFinding(payload: ScannerPayload, orgId: string, apiKeyId: string, ipAddress: string): Promise<IngestResult>;
    ingestBatch(payloads: ScannerPayload[], orgId: string, apiKeyId: string, ipAddress: string): Promise<{
        total: number;
        created: number;
        duplicates: number;
        errors: number;
        results: IngestResult[];
    }>;
    private normalizeDescription;
    private normalizeTechnicalDetail;
}
