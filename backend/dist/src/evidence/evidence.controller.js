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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const evidence_service_1 = require("./evidence.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const class_validator_1 = require("class-validator");
const multer_1 = require("multer");
class SupersedeDto {
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupersedeDto.prototype, "evidenceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SupersedeDto.prototype, "reason", void 0);
let EvidenceController = class EvidenceController {
    constructor(evidenceService, prisma) {
        this.evidenceService = evidenceService;
        this.prisma = prisma;
    }
    async listEvidence(findingId, user) {
        const finding = await this.prisma.finding.findFirst({
            where: { id: findingId },
        });
        if (!finding)
            return [];
        const evidence = await this.prisma.evidence.findMany({
            where: { findingId },
        });
        return evidence.map(e => ({
            id: e.id,
            findingId: e.findingId,
            evidenceType: e.evidenceType,
            fileName: e.fileName,
            sha256Hash: e.sha256Hash,
            fileSize: e.fileSize,
            mimeType: e.mimeType,
            description: e.description,
            storageRef: e.storageRef,
            isSuperseded: e.isSuperseded,
            supersededById: e.supersededById,
            uploadedBy: {
                id: e.uploadedById,
                name: "Authorized User",
                email: "System",
                role: "USER",
            },
        }));
    }
    async upload(findingId, file, evidenceType, description, clientHash, user, req) {
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        if (!evidenceType)
            throw new common_1.BadRequestException('evidenceType is required');
        const result = await this.evidenceService.upload({
            findingId,
            evidenceType,
            description,
            file: {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer,
            },
            uploadedById: user.id,
            orgId: user.orgId,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'],
        });
        return result;
    }
    async supersede(evidenceId, file, dto, user, req) {
        if (!file)
            throw new common_1.BadRequestException('No replacement file uploaded');
        return this.evidenceService.supersede({
            evidenceId,
            reason: dto.reason,
            newFile: {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer,
            },
            requestedById: user.id,
            orgId: user.orgId,
            ipAddress: req.ip || 'unknown',
        });
    }
    async verify(evidenceId, user) {
        return this.evidenceService.verifyIntegrity(evidenceId, user.orgId);
    }
};
exports.EvidenceController = EvidenceController;
__decorate([
    (0, common_1.Get)('findings/:findingId/evidence'),
    (0, roles_decorator_1.Roles)('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER'),
    __param(0, (0, common_1.Param)('findingId')),
    __param(1, (0, roles_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "listEvidence", null);
__decorate([
    (0, common_1.Post)('findings/:findingId/evidence'),
    (0, roles_decorator_1.Roles)('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 50 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('findingId')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('evidenceType')),
    __param(3, (0, common_1.Body)('description')),
    __param(4, (0, common_1.Body)('clientHash')),
    __param(5, (0, roles_decorator_1.CurrentUser)()),
    __param(6, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('evidence/:id/supersede'),
    (0, roles_decorator_1.Roles)('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 50 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, roles_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, SupersedeDto, Object, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "supersede", null);
__decorate([
    (0, common_1.Get)('evidence/:id/verify'),
    (0, roles_decorator_1.Roles)('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, roles_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvidenceController.prototype, "verify", null);
exports.EvidenceController = EvidenceController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard, auth_guard_1.OrgScopeGuard),
    __metadata("design:paramtypes", [evidence_service_1.EvidenceService,
        prisma_service_1.PrismaService])
], EvidenceController);
//# sourceMappingURL=evidence.controller.js.map