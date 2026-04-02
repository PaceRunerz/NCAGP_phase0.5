import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
interface UploadOptions {
    path: string;
    buffer: Buffer;
    contentType: string;
    encryptionKeyId?: string;
    metadata?: Record<string, string>;
}
export declare class StorageService implements OnModuleInit {
    private config;
    private readonly logger;
    private client;
    private bucket;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    private ensureBucketExists;
    upload(options: UploadOptions): Promise<{
        path: string;
    }>;
    download(path: string): Promise<Buffer>;
    generatePresignedUrl(path: string, expirySeconds?: number): Promise<string>;
    objectExists(path: string): Promise<boolean>;
}
export {};
