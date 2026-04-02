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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IngestController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestController = void 0;
const common_1 = require("@nestjs/common");
const ingest_service_1 = require("./ingest.service");
const apikeys_service_1 = require("../apikeys/apikeys.service");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class SingleFindingDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "audit_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "asset_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "control_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "root_cause", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "recommendation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "technical_detail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "plugin_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "plugin_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "host", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "port", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "protocol", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "solution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "synopsis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SingleFindingDto.prototype, "cvss_score", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SingleFindingDto.prototype, "cve", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SingleFindingDto.prototype, "cwe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "rule_key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "component", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "oid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "nvt_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SingleFindingDto.prototype, "threat", void 0);
class BatchFindingsDto {
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SingleFindingDto),
    __metadata("design:type", Array)
], BatchFindingsDto.prototype, "findings", void 0);
let IngestController = IngestController_1 = class IngestController {
    constructor(ingestService, apiKeysService) {
        this.ingestService = ingestService;
        this.apiKeysService = apiKeysService;
        this.logger = new common_1.Logger(IngestController_1.name);
    }
    async ingestSingle(dto, apiKey, req) {
        const { orgId } = await this.validateApiKey(apiKey, 'FINDINGS_WRITE');
        const result = await this.ingestService.ingestFinding(dto, orgId, apiKey.slice(0, 16), req.ip || 'unknown');
        return {
            success: true,
            ...result,
        };
    }
    async ingestBatch(dto, apiKey, req) {
        if (dto.findings.length > 500) {
            throw new common_1.BadRequestException('Batch size exceeds limit of 500 findings. Split into multiple requests.');
        }
        const { orgId } = await this.validateApiKey(apiKey, 'FINDINGS_WRITE');
        const result = await this.ingestService.ingestBatch(dto.findings, orgId, apiKey.slice(0, 16), req.ip || 'unknown');
        this.logger.log(`Batch ingestion complete: ${result.created} created, ${result.duplicates} duplicates, ${result.errors} errors`);
        return {
            success: result.errors === 0 || result.created > 0,
            ...result,
        };
    }
    async validateApiKey(rawKey, requiredScope) {
        if (!rawKey) {
            throw new common_1.UnauthorizedException('Missing X-API-Key header. Generate a key at /settings in the NCAGP portal.');
        }
        if (!rawKey.startsWith('ncagp_sk_')) {
            throw new common_1.UnauthorizedException('Invalid API key format. Must start with ncagp_sk_');
        }
        const keyData = await this.apiKeysService.validateKey(rawKey);
        if (!keyData) {
            throw new common_1.UnauthorizedException('Invalid or revoked API key. Generate a new key at /settings.');
        }
        if (!keyData.scopes.includes(requiredScope) && !keyData.scopes.includes('FULL_ACCESS')) {
            throw new common_1.ForbiddenException(`API key lacks required scope: ${requiredScope}. ` +
                `Key scopes: ${keyData.scopes.join(', ')}. Update key permissions in the portal.`);
        }
        return keyData;
    }
};
exports.IngestController = IngestController;
__decorate([
    (0, common_1.Post)('scanner'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-api-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SingleFindingDto, String, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "ingestSingle", null);
__decorate([
    (0, common_1.Post)('scanner/batch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-api-key')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BatchFindingsDto, String, Object]),
    __metadata("design:returntype", Promise)
], IngestController.prototype, "ingestBatch", null);
exports.IngestController = IngestController = IngestController_1 = __decorate([
    (0, common_1.Controller)('v1/ingest'),
    __metadata("design:paramtypes", [ingest_service_1.IngestService,
        apikeys_service_1.ApiKeysService])
], IngestController);
//# sourceMappingURL=ingest.controller.js.map