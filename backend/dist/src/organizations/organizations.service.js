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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
let OrganizationsService = class OrganizationsService {
    constructor(prisma, ledger) {
        this.prisma = prisma;
        this.ledger = ledger;
    }
    async create(dto) {
        const existing = await this.prisma.organization.findUnique({
            where: { shortCode: dto.shortCode },
        });
        if (existing)
            throw new common_1.ConflictException(`Short code '${dto.shortCode}' already exists`);
        const org = await this.prisma.organization.create({
            data: {
                name: dto.name,
                shortCode: dto.shortCode,
                orgType: dto.orgType,
                parentOrgId: dto.parentOrgId,
                encryptionDomain: dto.encryptionDomain,
                dataAccessScope: [],
            },
        });
        await this.ledger.record({
            userId: dto.createdById,
            orgId: org.id,
            eventType: 'ORG_CREATED',
            entityType: 'Organization',
            entityId: org.id,
            payload: { name: org.name, shortCode: org.shortCode, orgType: org.orgType },
            ipAddress: dto.ipAddress,
        });
        return org;
    }
    async findAll(requesterRole) {
        return this.prisma.organization.findMany({
            where: { isActive: true },
            include: {
                _count: {
                    select: { users: true, assets: true, findings: true },
                },
            },
            orderBy: [{ orgType: 'asc' }, { name: 'asc' }],
        });
    }
    async findOne(id) {
        const org = await this.prisma.organization.findUnique({
            where: { id },
            include: {
                users: { select: { id: true, name: true, email: true, role: true, isActive: true } },
                _count: { select: { assets: true, findings: true } },
            },
        });
        if (!org)
            throw new common_1.NotFoundException('Organization not found');
        return org;
    }
};
exports.OrganizationsService = OrganizationsService;
exports.OrganizationsService = OrganizationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ledger_service_1.LedgerService])
], OrganizationsService);
//# sourceMappingURL=organizations.service.js.map