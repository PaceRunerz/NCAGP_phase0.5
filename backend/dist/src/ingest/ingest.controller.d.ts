import { IngestService, ScannerPayload } from './ingest.service';
import { ApiKeysService } from '../apikeys/apikeys.service';
import { Request } from 'express';
declare class SingleFindingDto implements ScannerPayload {
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
declare class BatchFindingsDto {
    findings: SingleFindingDto[];
}
export declare class IngestController {
    private ingestService;
    private apiKeysService;
    private readonly logger;
    constructor(ingestService: IngestService, apiKeysService: ApiKeysService);
    ingestSingle(dto: SingleFindingDto, apiKey: string, req: Request): Promise<{
        findingId: string;
        ledgerEntryId: string;
        severity: string;
        slaDate: string;
        isDuplicate: boolean;
        message: string;
        success: boolean;
    }>;
    ingestBatch(dto: BatchFindingsDto, apiKey: string, req: Request): Promise<{
        total: number;
        created: number;
        duplicates: number;
        errors: number;
        results: import("./ingest.service").IngestResult[];
        success: boolean;
    }>;
    private validateApiKey;
}
export {};
