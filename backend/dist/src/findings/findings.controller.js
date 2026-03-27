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
exports.FindingsController = void 0;
const common_1 = require("@nestjs/common");
const findings_service_1 = require("./findings.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class CreateFindingDto {
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "auditId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "orgId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "assetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "controlId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.Severity),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "rootCause", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "recommendation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFindingDto.prototype, "technicalDetail", void 0);
class TransitionFindingDto {
}
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FindingStatus),
    __metadata("design:type", String)
], TransitionFindingDto.prototype, "newStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionFindingDto.prototype, "comment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionFindingDto.prototype, "closureJustification", void 0);
let FindingsController = class FindingsController {
    constructor(findingsService) {
        this.findingsService = findingsService;
    }
    async getRiskHeatmap() {
        return this.findingsService.getRiskHeatmap();
    }
    async findAll(user, orgId, severity, status, auditId, page, limit) {
        return this.findingsService.findAll({
            orgId,
            requestingUserId: user.id,
            requestingUserRole: user.role,
            requestingUserOrgId: user.orgId,
            requestingUserDataScope: user.dataAccessScope,
            severity,
            status,
            auditId,
            page,
            limit,
        });
    }
    async create(dto, user, req) {
        return this.findingsService.create({
            ...dto,
            createdById: user.id,
            ipAddress: req.ip || 'unknown',
        });
    }
    async getHistory(id, user) {
        return this.findingsService.findAll({
            requestingUserId: user.id,
            requestingUserRole: user.role,
            requestingUserOrgId: user.orgId,
            requestingUserDataScope: user.dataAccessScope,
            auditId: id,
        });
    }
    async transition(findingId, dto, user, req) {
        return this.findingsService.transition({
            findingId,
            newStatus: dto.newStatus,
            comment: dto.comment,
            closureJustification: dto.closureJustification,
            requestedById: user.id,
            requestedByRole: user.role,
            orgId: user.orgId,
            ipAddress: req.ip || 'unknown',
        });
    }
};
exports.FindingsController = FindingsController;
__decorate([
    (0, common_1.Get)('risk-heatmap'),
    (0, roles_decorator_1.Roles)('NIC_ADMIN', 'DEPT_CISO'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FindingsController.prototype, "getRiskHeatmap", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, roles_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('orgId')),
    __param(2, (0, common_1.Query)('severity')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('auditId')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], FindingsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('NIC_ADMIN', 'AUDITOR', 'VENDOR_ADMIN'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, roles_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateFindingDto, Object, Object]),
    __metadata("design:returntype", Promise)
], FindingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, roles_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FindingsController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, roles_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TransitionFindingDto, Object, Object]),
    __metadata("design:returntype", Promise)
], FindingsController.prototype, "transition", null);
exports.FindingsController = FindingsController = __decorate([
    (0, common_1.Controller)('findings'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard, auth_guard_1.OrgScopeGuard),
    __metadata("design:paramtypes", [findings_service_1.FindingsService])
], FindingsController);
//# sourceMappingURL=findings.controller.js.map