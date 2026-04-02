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
var LedgerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto = require("crypto");
let LedgerService = LedgerService_1 = class LedgerService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(LedgerService_1.name);
    }
    async onModuleInit() {
        this.logger.log('Ledger service initialized. Chain tip loaded.');
    }
    async record(entry) {
        return await this.prisma.$transaction(async (tx) => {
            const lastEntry = await tx.auditLedger.findFirst({
                orderBy: { timestamp: 'desc' },
                select: { hashCurrent: true }
            });
            const hashPrev = lastEntry
                ? lastEntry.hashCurrent
                : LedgerService_1.GENESIS_HASH;
            const payloadHash = crypto
                .createHash('sha256')
                .update(JSON.stringify(entry.payload, Object.keys(entry.payload).sort()))
                .digest('hex');
            const timestamp = new Date().toISOString();
            const hashInput = [
                hashPrev,
                timestamp,
                entry.userId,
                entry.orgId,
                entry.eventType,
                entry.entityType,
                entry.entityId,
                payloadHash,
            ].join('|');
            const hashCurrent = crypto
                .createHash('sha256')
                .update(hashInput)
                .digest('hex');
            const ledgerEntry = await tx.auditLedger.create({
                data: {
                    userId: entry.userId,
                    orgId: entry.orgId,
                    eventType: entry.eventType,
                    entityType: entry.entityType,
                    entityId: entry.entityId,
                    payload: entry.payload,
                    ipAddress: entry.ipAddress,
                    userAgent: entry.userAgent,
                    hashPrev,
                    hashCurrent,
                    timestamp: new Date(timestamp),
                },
            });
            this.logger.debug(`Ledger entry recorded: ${entry.eventType} on ${entry.entityType}:${entry.entityId} | hash: ${hashCurrent.substring(0, 16)}...`);
            return ledgerEntry.id;
        });
    }
    async verifyChainIntegrity(fromTimestamp, toTimestamp) {
        const entries = await this.prisma.auditLedger.findMany({
            where: {
                timestamp: {
                    gte: fromTimestamp,
                    lte: toTimestamp,
                },
            },
            orderBy: { timestamp: 'asc' },
            select: {
                id: true,
                userId: true,
                orgId: true,
                eventType: true,
                entityType: true,
                entityId: true,
                payload: true,
                ipAddress: true,
                timestamp: true,
                hashPrev: true,
                hashCurrent: true,
            },
        });
        if (entries.length === 0) {
            return { isValid: true, totalEntries: 0 };
        }
        let expectedPrevHash = LedgerService_1.GENESIS_HASH;
        for (const entry of entries) {
            if (entry.hashPrev !== expectedPrevHash) {
                return {
                    isValid: false,
                    totalEntries: entries.length,
                    brokenAt: entry.timestamp.toISOString(),
                    brokenEntryId: entry.id,
                };
            }
            const payloadHash = crypto
                .createHash('sha256')
                .update(JSON.stringify(entry.payload, Object.keys(entry.payload).sort()))
                .digest('hex');
            const hashInput = [
                entry.hashPrev,
                entry.timestamp.toISOString(),
                entry.userId,
                entry.orgId,
                entry.eventType,
                entry.entityType,
                entry.entityId,
                payloadHash,
            ].join('|');
            const recomputedHash = crypto
                .createHash('sha256')
                .update(hashInput)
                .digest('hex');
            if (recomputedHash !== entry.hashCurrent) {
                return {
                    isValid: false,
                    totalEntries: entries.length,
                    brokenAt: entry.timestamp.toISOString(),
                    brokenEntryId: entry.id,
                };
            }
            expectedPrevHash = entry.hashCurrent;
        }
        return { isValid: true, totalEntries: entries.length };
    }
    async getEntityHistory(entityType, entityId) {
        return this.prisma.auditLedger.findMany({
            where: { entityType, entityId },
            orderBy: { timestamp: 'asc' },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
    }
};
exports.LedgerService = LedgerService;
LedgerService.GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
exports.LedgerService = LedgerService = LedgerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LedgerService);
//# sourceMappingURL=ledger.service.js.map