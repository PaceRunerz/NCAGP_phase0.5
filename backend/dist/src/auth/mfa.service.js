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
var MfaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
const speakeasy = require("speakeasy");
const QRCode = require('qrcode');
const crypto = require("crypto");
let MfaService = MfaService_1 = class MfaService {
    constructor(prisma, ledger) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.logger = new common_1.Logger(MfaService_1.name);
    }
    async setupMfa(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, mfaEnabled: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        if (user.mfaEnabled)
            throw new common_1.BadRequestException('MFA is already enabled on this account');
        const secret = speakeasy.generateSecret({
            name: `NCAGP (${user.email})`,
            issuer: 'NIC-NCAGP',
            length: 32,
        });
        const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
        const hashedCodes = backupCodes.map(code => crypto.createHash('sha256').update(code).digest('hex'));
        await this.prisma.$executeRaw `
      UPDATE users 
      SET "mfaSecret" = ${secret.base32}, "mfaBackupCodes" = ${hashedCodes}
      WHERE id = ${userId}
    `;
        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
        this.logger.log(`MFA setup initiated for user ${userId}`);
        return {
            qrCodeDataUrl,
            manualEntryKey: secret.base32,
            backupCodes,
        };
    }
    async enableMfa(userId, orgId, totpCode, ipAddress) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { mfaSecret: true, mfaEnabled: true },
        });
        if (!user?.mfaSecret)
            throw new common_1.BadRequestException('MFA setup not initiated. Call /auth/mfa/setup first.');
        if (user.mfaEnabled)
            throw new common_1.BadRequestException('MFA already enabled');
        const isValid = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: totpCode,
            window: 1,
        });
        if (!isValid)
            throw new common_1.UnauthorizedException('Invalid TOTP code. Make sure your authenticator is synced.');
        await this.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: true },
        });
        await this.ledger.record({
            userId, orgId,
            eventType: 'USER_LOGIN',
            entityType: 'User', entityId: userId,
            payload: { action: 'MFA_ENABLED', method: 'TOTP' },
            ipAddress,
        });
        this.logger.log(`MFA enabled for user ${userId}`);
    }
    async disableMfa(userId, orgId, totpCode, ipAddress) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { mfaSecret: true, mfaEnabled: true },
        });
        if (!user?.mfaEnabled)
            throw new common_1.BadRequestException('MFA is not enabled');
        const isValid = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: totpCode,
            window: 1,
        });
        if (!isValid)
            throw new common_1.UnauthorizedException('Invalid TOTP code');
        await this.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: false, mfaSecret: null },
        });
        await this.ledger.record({
            userId, orgId,
            eventType: 'USER_LOGIN',
            entityType: 'User', entityId: userId,
            payload: { action: 'MFA_DISABLED' },
            ipAddress,
        });
    }
    async getMfaStatus(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { mfaEnabled: true, email: true },
        });
        return {
            mfaEnabled: user?.mfaEnabled ?? false,
            email: user?.email,
        };
    }
};
exports.MfaService = MfaService;
exports.MfaService = MfaService = MfaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ledger_service_1.LedgerService])
], MfaService);
//# sourceMappingURL=mfa.service.js.map