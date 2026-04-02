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
exports.LedgerController = void 0;
const common_1 = require("@nestjs/common");
const ledger_service_1 = require("./ledger.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const class_validator_1 = require("class-validator");
class VerifyChainDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], VerifyChainDto.prototype, "fromTimestamp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], VerifyChainDto.prototype, "toTimestamp", void 0);
let LedgerController = class LedgerController {
    constructor(ledger) {
        this.ledger = ledger;
    }
    async getEntityHistory(entityType, entityId) {
        return this.ledger.getEntityHistory(entityType, entityId);
    }
    async verifyChain(dto) {
        return this.ledger.verifyChainIntegrity(dto.fromTimestamp ? new Date(dto.fromTimestamp) : undefined, dto.toTimestamp ? new Date(dto.toTimestamp) : undefined);
    }
};
exports.LedgerController = LedgerController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('entityType')),
    __param(1, (0, common_1.Query)('entityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LedgerController.prototype, "getEntityHistory", null);
__decorate([
    (0, common_1.Post)('verify-chain'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, roles_decorator_1.Roles)('NIC_ADMIN'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VerifyChainDto]),
    __metadata("design:returntype", Promise)
], LedgerController.prototype, "verifyChain", null);
exports.LedgerController = LedgerController = __decorate([
    (0, common_1.Controller)('ledger'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], LedgerController);
//# sourceMappingURL=ledger.controller.js.map