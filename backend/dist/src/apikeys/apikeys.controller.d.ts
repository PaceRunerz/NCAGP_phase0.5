import { ApiKeysService } from './apikeys.service';
import { Request } from 'express';
declare class CreateApiKeyDto {
    name: string;
    scopes: string[];
    expiresInDays?: number;
}
export declare class ApiKeysController {
    private apiKeys;
    constructor(apiKeys: ApiKeysService);
    list(user: any): Promise<any[]>;
    create(dto: CreateApiKeyDto, user: any, req: Request): Promise<any>;
    revoke(id: string, user: any, req: Request): Promise<{
        message: string;
    }>;
}
export {};
