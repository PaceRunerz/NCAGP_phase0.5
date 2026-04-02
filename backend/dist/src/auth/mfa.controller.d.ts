import { MfaService } from './mfa.service';
import { Request } from 'express';
declare class VerifyMfaDto {
    totpCode: string;
}
export declare class MfaController {
    private mfa;
    constructor(mfa: MfaService);
    status(user: any): Promise<{
        mfaEnabled: boolean;
        email: string | undefined;
    }>;
    setup(user: any): Promise<{
        qrCodeDataUrl: string;
        manualEntryKey: string;
        backupCodes: string[];
    }>;
    enable(dto: VerifyMfaDto, user: any, req: Request): Promise<{
        message: string;
    }>;
    disable(dto: VerifyMfaDto, user: any, req: Request): Promise<{
        message: string;
    }>;
}
export {};
