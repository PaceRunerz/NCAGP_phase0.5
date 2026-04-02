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
exports.MfaController = void 0;
const common_1 = require("@nestjs/common");
const mfa_service_1 = require("./mfa.service");
const auth_guard_1 = require("./guards/auth.guard");
const roles_decorator_1 = require("./roles.decorator");
const class_validator_1 = require("class-validator");
class VerifyMfaDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], VerifyMfaDto.prototype, "totpCode", void 0);
let MfaController = class MfaController {
    constructor(mfa) {
        this.mfa = mfa;
    }
    async status(user) {
        return this.mfa.getMfaStatus(user.id);
    }
    async setup(user) {
        return this.mfa.setupMfa(user.id);
    }
    async enable(dto, user, req) {
        await this.mfa.enableMfa(user.id, user.orgId, dto.totpCode, req.ip || 'unknown');
        return { message: 'MFA enabled successfully. Your account is now protected with two-factor authentication.' };
    }
    async disable(dto, user, req) {
        await this.mfa.disableMfa(user.id, user.orgId, dto.totpCode, req.ip || 'unknown');
        return { message: 'MFA disabled.' };
    }
};
exports.MfaController = MfaController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, roles_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MfaController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('setup'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, roles_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MfaController.prototype, "setup", null);
__decorate([
    (0, common_1.Post)('enable'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, roles_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VerifyMfaDto, Object, Object]),
    __metadata("design:returntype", Promise)
], MfaController.prototype, "enable", null);
__decorate([
    (0, common_1.Post)('disable'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, roles_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VerifyMfaDto, Object, Object]),
    __metadata("design:returntype", Promise)
], MfaController.prototype, "disable", null);
exports.MfaController = MfaController = __decorate([
    (0, common_1.Controller)('auth/mfa'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [mfa_service_1.MfaService])
], MfaController);
//# sourceMappingURL=mfa.controller.js.map