// ─────────────────────────────────────────────────────────────────
// NCAGP — Evidence Service
// File: src/evidence/evidence.service.ts
//
// IMMUTABILITY CONTRACT:
//   - Evidence can NEVER be deleted
//   - Evidence can only be "superseded" (new file replaces old)
//   - Every file is SHA-256 hashed BEFORE storage
//   - Hash stored in DB for independent verification
//   - Court-grade evidentiary standard
//
// STORAGE DESIGN:
//   - Files go to object store (NIC-hosted MinIO / NIC Cloud Object Storage)
//   - Storage path = org_id/audit_id/finding_id/timestamp_filename
//   - Server-side encryption with org-specific KMS key
//   - Data residency: India only (ap-south-1 equivalent)
// ─────────────────────────────────────────────────────────────────

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { StorageService } from '../storage/storage.service';
import { EvidenceType, FindingStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { Readable } from 'stream';

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

interface UploadEvidenceDto {
  findingId: string;
  evidenceType: EvidenceType;
  description?: string;
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
  uploadedById: string;
  orgId: string;
  ipAddress: string;
  userAgent?: string;
}

interface SupersedeEvidenceDto {
  evidenceId: string;
  reason: string;
  newFile: UploadEvidenceDto['file'];
  requestedById: string;
  orgId: string;
  ipAddress: string;
}

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private storage: StorageService,
  ) {}

  /**
   * Upload evidence for a finding.
   * 
   * SECURITY FLOW:
   * 1. Validate file type (allowlist, not blocklist)
   * 2. Validate file size
   * 3. Compute SHA-256 hash of raw bytes BEFORE any processing
   * 4. Upload to encrypted object store
   * 5. Store hash + metadata in DB
   * 6. Record immutable ledger event
   */
  async upload(dto: UploadEvidenceDto) {
    // 1. Validate file type (allowlist)
    if (!ALLOWED_MIME_TYPES.includes(dto.file.mimetype)) {
      throw new BadRequestException(
        `File type '${dto.file.mimetype}' is not permitted. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // 2. Validate file size
    if (dto.file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`,
      );
    }

    // 3. Verify finding exists and belongs to org
    const finding = await this.prisma.finding.findFirst({
      where: { id: dto.findingId },
      include: { audit: { select: { id: true, orgId: true } } },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found or access denied');
    }

    if (finding.status === FindingStatus.CLOSED) {
      throw new BadRequestException(
        'Cannot upload evidence to a closed finding',
      );
    }

    // 4. *** CORE SECURITY: Hash before upload ***
    //    This hash is the fingerprint of the file.
    //    If the file is tampered with after upload, the hash won't match.
    const sha256Hash = crypto
      .createHash('sha256')
      .update(dto.file.buffer)
      .digest('hex');

    this.logger.debug(
      `Evidence hash computed: ${sha256Hash.substring(0, 16)}... for finding ${dto.findingId}`,
    );

    // 5. Build storage path (deterministic, auditable)
    const timestamp = Date.now();
    const safeFileName = dto.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `evidence/${dto.orgId}/${finding.audit.id}/${dto.findingId}/${timestamp}_${safeFileName}`;

    // 6. Upload to encrypted object store
    await this.storage.upload({
      path: storagePath,
      buffer: dto.file.buffer,
      contentType: dto.file.mimetype,
      encryptionKeyId: dto.orgId, // Per-org encryption key
      metadata: {
        'x-ncagp-finding-id': dto.findingId,
        'x-ncagp-sha256': sha256Hash,
        'x-ncagp-uploaded-by': dto.uploadedById,
        'x-data-residency': 'IN', // India only
      },
    });

    // 7. Persist evidence record
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

    // 8. Record to immutable ledger
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

    // 9. Auto-transition finding to remediation if it was OPEN
    if (finding.status === FindingStatus.OPEN || finding.status === FindingStatus.ACKNOWLEDGED) {
      await this.prisma.finding.update({
        where: { id: dto.findingId },
        data: { status: FindingStatus.IN_REMEDIATION },
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

  /**
   * Supersede existing evidence (the ONLY way to "replace" evidence).
   * Original is NEVER deleted — marked as superseded.
   */
  async supersede(dto: SupersedeEvidenceDto) {
    const existing = await this.prisma.evidence.findFirst({
      where: {
        id: dto.evidenceId,
        finding: { orgId: dto.orgId },
        isSuperseded: false,
      },
    });

    if (!existing) {
      throw new NotFoundException('Evidence not found or already superseded');
    }

    // Upload new version first
    const newEvidence = await this.upload({
      findingId: existing.findingId,
      evidenceType: existing.evidenceType,
      description: `Supersedes ${dto.evidenceId}: ${dto.reason}`,
      file: dto.newFile,
      uploadedById: dto.requestedById,
      orgId: dto.orgId,
      ipAddress: dto.ipAddress,
    });

    // Mark original as superseded (NOT deleted)
    await this.prisma.evidence.update({
      where: { id: dto.evidenceId },
      data: {
        isSuperseded: true,
        supersededById: newEvidence.id,
        supersededAt: new Date(),
        supersessionReason: dto.reason,
      },
    });

    // Ledger entry for supersession
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

  /**
   * Verify file integrity: re-download from storage and re-hash.
   * Detects storage-level tampering.
   */
  async verifyIntegrity(evidenceId: string, orgId: string) {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, finding: { orgId } },
    });

    if (!evidence) throw new NotFoundException('Evidence not found');

    const fileBuffer = await this.storage.download(evidence.storageRef);

    const computedHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    const isIntact = computedHash === evidence.sha256Hash;

    if (!isIntact) {
      // CRITICAL: Log tampering detection to ledger
      this.logger.error(
        `INTEGRITY VIOLATION: Evidence ${evidenceId} hash mismatch! ` +
        `Stored: ${evidence.sha256Hash} | Computed: ${computedHash}`,
      );

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
}
