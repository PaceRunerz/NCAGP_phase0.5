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
var ApiKeysService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeysService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
let ApiKeysService = ApiKeysService_1 = class ApiKeysService {
    constructor(prisma, ledger) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.logger = new common_1.Logger(ApiKeysService_1.name);
    }
    async create(dto) {
        const rawKey = `ncagp_sk_${crypto.randomBytes(32).toString('hex')}`;
        const keyPrefix = rawKey.slice(0, 12);
        const keyHash = await bcrypt.hash(rawKey, 10);
        const expiresAt = dto.expiresInDays
            ? new Date(Date.now() + dto.expiresInDays * 86400000)
            : null;
        const result = await this.prisma.$queryRaw `
      INSERT INTO api_keys (id, "orgId", name, "keyHash", "keyPrefix", scopes, "createdById", "expiresAt")
      VALUES (
        gen_random_uuid(),
        ${dto.orgId},
        ${dto.name},
        ${keyHash},
        ${keyPrefix},
        ${dto.scopes}::"ApiKeyScope"[],
        ${dto.createdById},
        ${expiresAt ? expiresAt.toISOString() : null}::timestamptz
      )
      RETURNING id, name, "keyPrefix", scopes, "createdAt", "expiresAt"
    `;
        const created = result[0];
        await this.ledger.record({
            userId: dto.createdById,
            orgId: dto.orgId,
            eventType: 'AUDIT_CREATED',
            entityType: 'ApiKey',
            entityId: created.id,
            payload: { name: dto.name, scopes: dto.scopes, keyPrefix },
            ipAddress: dto.ipAddress,
        });
        this.logger.log(`API key created: ${dto.name} for org ${dto.orgId}`);
        return {
            ...created,
            rawKey,
            warning: 'Save this key now. It will never be shown again.',
        };
    }
    async list(orgId) {
        return this.prisma.$queryRaw `
      SELECT id, name, "keyPrefix", scopes, "createdAt", "expiresAt", "lastUsedAt", "isRevoked"
      FROM api_keys
      WHERE "orgId" = ${orgId} AND "isRevoked" = false
      ORDER BY "createdAt" DESC
    `;
    }
    async revoke(keyId, orgId, revokedBy, ipAddress) {
        const keys = await this.prisma.$queryRaw `
      SELECT id FROM api_keys WHERE id = ${keyId} AND "orgId" = ${orgId} AND "isRevoked" = false
    `;
        if (keys.length === 0)
            throw new common_1.NotFoundException('API key not found');
        await this.prisma.$executeRaw `
      UPDATE api_keys 
      SET "isRevoked" = true, "revokedAt" = NOW(), "revokedBy" = ${revokedBy}
      WHERE id = ${keyId}
    `;
        await this.ledger.record({
            userId: revokedBy, orgId,
            eventType: 'AUDIT_CREATED',
            entityType: 'ApiKey', entityId: keyId,
            payload: { action: 'REVOKED' },
            ipAddress,
        });
        return { message: 'API key revoked successfully' };
    }
    async validateKey(rawKey) {
        if (!rawKey.startsWith('ncagp_sk_'))
            return null;
        const prefix = rawKey.slice(0, 12);
        const candidates = await this.prisma.$queryRaw `
      SELECT id, "orgId", "keyHash", scopes, "expiresAt", "isRevoked"
      FROM api_keys
      WHERE "keyPrefix" = ${prefix} AND "isRevoked" = false
    `;
        for (const key of candidates) {
            if (key.expiresAt && new Date(key.expiresAt) < new Date())
                continue;
            const matches = await bcrypt.compare(rawKey, key.keyHash);
            if (matches) {
                await this.prisma.$executeRaw `
          UPDATE api_keys SET "lastUsedAt" = NOW() WHERE id = ${key.id}
        `;
                return { orgId: key.orgId, scopes: key.scopes };
            }
        }
        return null;
    }
};
exports.ApiKeysService = ApiKeysService;
exports.ApiKeysService = ApiKeysService = ApiKeysService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ledger_service_1.LedgerService])
], ApiKeysService);
//# sourceMappingURL=apikeys.service.js.map