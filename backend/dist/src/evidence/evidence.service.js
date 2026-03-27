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
var EvidenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ledger_service_1 = require("../ledger/ledger.service");
const storage_service_1 = require("../storage/storage.service");
const client_1 = require("@prisma/client");
const crypto = require("crypto");
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'application/zip',
    'video/mp4',
];
let EvidenceService = EvidenceService_1 = class EvidenceService {
    constructor(prisma, ledger, storage) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.storage = storage;
        this.logger = new common_1.Logger(EvidenceService_1.name);
    }
    async upload(dto) {
        if (!ALLOWED_MIME_TYPES.includes(dto.file.mimetype)) {
            throw new common_1.BadRequestException(`File type '${dto.file.mimetype}' is not permitted. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
        }
        if (dto.file.size > MAX_FILE_SIZE_BYTES) {
            throw new common_1.BadRequestException(`File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`);
        }
        const finding = await this.prisma.finding.findFirst({
            where: { id: dto.findingId, orgId: dto.orgId },
            include: { audit: { select: { id: true, orgId: true } } },
        });
        if (!finding) {
            throw new common_1.NotFoundException('Finding not found or access denied');
        }
        if (finding.status === client_1.FindingStatus.CLOSED) {
            throw new common_1.BadRequestException('Cannot upload evidence to a closed finding');
        }
        const sha256Hash = crypto
            .createHash('sha256')
            .update(dto.file.buffer)
            .digest('hex');
        this.logger.debug(`Evidence hash computed: ${sha256Hash.substring(0, 16)}... for finding ${dto.findingId}`);
        const timestamp = Date.now();
        const safeFileName = dto.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `evidence/${dto.orgId}/${finding.audit.id}/${dto.findingId}/${timestamp}_${safeFileName}`;
        await this.storage.upload({
            path: storagePath,
            buffer: dto.file.buffer,
            contentType: dto.file.mimetype,
            encryptionKeyId: dto.orgId,
            metadata: {
                'x-ncagp-finding-id': dto.findingId,
                'x-ncagp-sha256': sha256Hash,
                'x-ncagp-uploaded-by': dto.uploadedById,
                'x-data-residency': 'IN',
            },
        });
        const evidence = await this.prisma.evidence.create({
            data: {
                findingId: dto.findingId,
                evidenceType: dto.evidenceType,
                fileName: safeFileName,
                fileSize: dto.file.size,
                mimeType: dto.file.mimetype,
                sha256Hash,
                storageRef: storagePath,
                storageRegion: 'ap-south-1',
                uploadedById: dto.uploadedById,
                description: dto.description,
            },
        });
        await this.ledger.record({
            userId: dto.uploadedById,
            orgId: dto.orgId,
            eventType: 'EVIDENCE_UPLOADED',
            entityType: 'Evidence',
            entityId: evidence.id,
            payload: {
                evidenceId: evidence.id,
                findingId: dto.findingId,
                fileName: safeFileName,
                fileSize: dto.file.size,
                sha256Hash,
                evidenceType: dto.evidenceType,
                storagePath,
            },
            ipAddress: dto.ipAddress,
            userAgent: dto.userAgent,
        });
        if (finding.status === client_1.FindingStatus.OPEN || finding.status === client_1.FindingStatus.ACKNOWLEDGED) {
            await this.prisma.finding.update({
                where: { id: dto.findingId },
                data: { status: client_1.FindingStatus.IN_REMEDIATION },
            });
        }
        return {
            id: evidence.id,
            sha256Hash,
            storageRef: storagePath,
            uploadedAt: evidence.uploadedAt,
            message: 'Evidence uploaded and hash-verified successfully',
        };
    }
    async supersede(dto) {
        const existing = await this.prisma.evidence.findFirst({
            where: {
                id: dto.evidenceId,
                finding: { orgId: dto.orgId },
                isSuperseded: false,
            },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Evidence not found or already superseded');
        }
        const newEvidence = await this.upload({
            findingId: existing.findingId,
            evidenceType: existing.evidenceType,
            description: `Supersedes ${dto.evidenceId}: ${dto.reason}`,
            file: dto.newFile,
            uploadedById: dto.requestedById,
            orgId: dto.orgId,
            ipAddress: dto.ipAddress,
        });
        await this.prisma.evidence.update({
            where: { id: dto.evidenceId },
            data: {
                isSuperseded: true,
                supersededById: newEvidence.id,
                supersededAt: new Date(),
                supersessionReason: dto.reason,
            },
        });
        await this.ledger.record({
            userId: dto.requestedById,
            orgId: dto.orgId,
            eventType: 'EVIDENCE_SUPERSEDED',
            entityType: 'Evidence',
            entityId: dto.evidenceId,
            payload: {
                originalEvidenceId: dto.evidenceId,
                newEvidenceId: newEvidence.id,
                reason: dto.reason,
            },
            ipAddress: dto.ipAddress,
        });
        return newEvidence;
    }
    async verifyIntegrity(evidenceId, orgId) {
        const evidence = await this.prisma.evidence.findFirst({
            where: { id: evidenceId, finding: { orgId } },
        });
        if (!evidence)
            throw new common_1.NotFoundException('Evidence not found');
        const fileBuffer = await this.storage.download(evidence.storageRef);
        const computedHash = crypto
            .createHash('sha256')
            .update(fileBuffer)
            .digest('hex');
        const isIntact = computedHash === evidence.sha256Hash;
        if (!isIntact) {
            this.logger.error(`INTEGRITY VIOLATION: Evidence ${evidenceId} hash mismatch! ` +
                `Stored: ${evidence.sha256Hash} | Computed: ${computedHash}`);
            await this.ledger.record({
                userId: 'SYSTEM',
                orgId,
                eventType: 'EVIDENCE_INTEGRITY_CHECK',
                entityType: 'Evidence',
                entityId: evidenceId,
                payload: {
                    status: 'FAILED',
                    storedHash: evidence.sha256Hash,
                    computedHash,
                    detectedAt: new Date().toISOString(),
                },
                ipAddress: 'SYSTEM',
            });
        }
        return {
            evidenceId,
            isIntact,
            storedHash: evidence.sha256Hash,
            computedHash,
            verifiedAt: new Date().toISOString(),
        };
    }
};
exports.EvidenceService = EvidenceService;
exports.EvidenceService = EvidenceService = EvidenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ledger_service_1.LedgerService,
        storage_service_1.StorageService])
], EvidenceService);
//# sourceMappingURL=evidence.service.js.map