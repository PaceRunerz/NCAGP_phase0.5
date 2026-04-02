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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwtService, ledger) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.ledger = ledger;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async login(email, password, ipAddress, userAgent) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { org: { select: { id: true, name: true, dataAccessScope: true } } },
        });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new common_1.ForbiddenException(`Account locked. Try again in ${minutesLeft} minutes.`);
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            const newAttempts = user.failedAttempts + 1;
            const lockout = newAttempts >= MAX_FAILED_ATTEMPTS;
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedAttempts: newAttempts,
                    ...(lockout && {
                        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60000),
                    }),
                },
            });
            if (lockout) {
                await this.ledger.record({
                    userId: user.id,
                    orgId: user.orgId,
                    eventType: 'USER_LOCKED',
                    entityType: 'User',
                    entityId: user.id,
                    payload: { reason: 'Max failed attempts', attempts: newAttempts },
                    ipAddress,
                    userAgent,
                });
                throw new common_1.ForbiddenException(`Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts.`);
            }
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        const sessionId = crypto.randomUUID();
        const mfaVerified = !user.mfaEnabled;
        const token = await this.generateToken(user, sessionId, mfaVerified);
        await this.createSession(user.id, sessionId, token, ipAddress, userAgent);
        await this.ledger.record({
            userId: user.id,
            orgId: user.orgId,
            eventType: 'USER_LOGIN',
            entityType: 'User',
            entityId: user.id,
            payload: { mfaRequired: user.mfaEnabled, mfaVerified },
            ipAddress,
            userAgent,
        });
        return {
            accessToken: token,
            requiresMfa: user.mfaEnabled && !mfaVerified,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                orgId: user.orgId,
                orgName: user.org.name,
            },
        };
    }
    async verifyMfa(userId, orgId, totpCode, sessionId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.mfaSecret) {
            throw new common_1.BadRequestException('MFA not configured for this user');
        }
        const isValid = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: totpCode,
            window: 1,
        });
        if (!isValid) {
            await this.ledger.record({
                userId,
                orgId,
                eventType: 'USER_MFA_BYPASS_ATTEMPT',
                entityType: 'User',
                entityId: userId,
                payload: { reason: 'Invalid TOTP code' },
                ipAddress: 'unknown',
            });
            throw new common_1.UnauthorizedException('Invalid MFA code');
        }
        const newToken = await this.generateToken(user, sessionId, true);
        const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
        await this.prisma.session.updateMany({
            where: { token: tokenHash, userId },
            data: { expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
        });
        return { accessToken: newToken };
    }
    async logout(userId, sessionId, ipAddress) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(sessionId)
            .digest('hex');
        await this.prisma.session.deleteMany({
            where: { token: tokenHash, userId },
        });
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            await this.ledger.record({
                userId,
                orgId: user.orgId,
                eventType: 'USER_LOGOUT',
                entityType: 'User',
                entityId: userId,
                payload: {},
                ipAddress,
            });
        }
        return { message: 'Logged out successfully' };
    }
    async generateToken(user, sessionId, mfaVerified) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            orgId: user.orgId,
            dataAccessScope: user.org?.dataAccessScope ?? [],
            mfaVerified,
            sessionId,
        };
        return this.jwtService.signAsync(payload);
    }
    async createSession(userId, sessionId, token, ipAddress, userAgent) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(sessionId)
            .digest('hex');
        const sessions = await this.prisma.session.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        if (sessions.length >= 3) {
            const toDelete = sessions.slice(0, sessions.length - 2);
            await this.prisma.session.deleteMany({
                where: { id: { in: toDelete.map((s) => s.id) } },
            });
        }
        await this.prisma.session.create({
            data: {
                userId,
                token: tokenHash,
                ipAddress,
                userAgent,
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        ledger_service_1.LedgerService])
], AuthService);
//# sourceMappingURL=auth.service.js.map