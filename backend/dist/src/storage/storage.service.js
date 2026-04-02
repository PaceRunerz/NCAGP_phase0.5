"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const Minio = require("minio");
let StorageService = StorageService_1 = class StorageService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(StorageService_1.name);
        const endpointRaw = this.config.get('STORAGE_ENDPOINT') || 'http://localhost:9000';
        const endpoint = new URL(endpointRaw);
        this.client = new Minio.Client({
            endPoint: endpoint.hostname,
            port: parseInt(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 80),
            useSSL: endpoint.protocol === 'https:',
            accessKey: this.config.get('STORAGE_ACCESS_KEY') || 'minioadmin',
            secretKey: this.config.get('STORAGE_SECRET_KEY') || 'minioadmin',
        });
        this.bucket = this.config.get('STORAGE_BUCKET') || 'ncagp-evidence';
    }
    async onModuleInit() {
        await this.ensureBucketExists();
    }
    async ensureBucketExists() {
        try {
            const exists = await this.client.bucketExists(this.bucket);
            if (!exists) {
                await this.client.makeBucket(this.bucket, 'ap-south-1');
                this.logger.log(`Bucket '${this.bucket}' created`);
            }
            else {
                this.logger.log(`Bucket '${this.bucket}' ready`);
            }
        }
        catch (err) {
            this.logger.error('Storage init failed — is MinIO running?', err);
        }
    }
    async upload(options) {
        const metaHeaders = {
            'Content-Type': options.contentType,
            ...options.metadata,
        };
        await this.client.putObject(this.bucket, options.path, options.buffer, options.buffer.length, metaHeaders);
        this.logger.debug(`Uploaded: ${options.path} (${options.buffer.length} bytes)`);
        return { path: options.path };
    }
    async download(path) {
        const stream = await this.client.getObject(this.bucket, path);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }
    async generatePresignedUrl(path, expirySeconds = 3600) {
        return this.client.presignedGetObject(this.bucket, path, expirySeconds);
    }
    async objectExists(path) {
        try {
            await this.client.statObject(this.bucket, path);
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map