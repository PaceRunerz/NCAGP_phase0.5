// ─────────────────────────────────────────────────────────────────
// NCAGP — API Keys Service
// File: src/apikeys/apikeys.service.ts
//
// Generates secure API tokens for scanner integrations.
// Token format: ncagp_sk_{32 random bytes hex}
// Only the hash is stored — raw key shown ONCE to user.
// ─────────────────────────────────────────────────────────────────

import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

interface CreateApiKeyDto {
  name: string;
  scopes: string[];
  orgId: string;
  createdById: string;
  expiresInDays?: number;
  ipAddress: string;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  /**
   * Create a new API key.
   * Returns the RAW key ONCE — it is never stored in plaintext.
   */
  async create(dto: CreateApiKeyDto) {
    // Generate cryptographically secure key
    const rawKey = `ncagp_sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12); // "ncagp_sk_XXX" shown in UI
    const keyHash = await bcrypt.hash(rawKey, 10);

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86400000)
      : null;

    // Store using raw SQL since ApiKey model may not be in Prisma client yet
    const result = await this.prisma.$queryRaw<any[]>`
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
      eventType: 'AUDIT_CREATED' as any,
      entityType: 'ApiKey',
      entityId: created.id,
      payload: { name: dto.name, scopes: dto.scopes, keyPrefix },
      ipAddress: dto.ipAddress,
    });

    this.logger.log(`API key created: ${dto.name} for org ${dto.orgId}`);

    return {
      ...created,
      rawKey, // ⚠️ SHOWN ONLY ONCE — not stored
      warning: 'Save this key now. It will never be shown again.',
    };
  }

  /**
   * List all API keys for an org (without raw keys)
   */
  async list(orgId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT id, name, "keyPrefix", scopes, "createdAt", "expiresAt", "lastUsedAt", "isRevoked"
      FROM api_keys
      WHERE "orgId" = ${orgId} AND "isRevoked" = false
      ORDER BY "createdAt" DESC
    `;
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string, orgId: string, revokedBy: string, ipAddress: string) {
    const keys = await this.prisma.$queryRaw<any[]>`
      SELECT id FROM api_keys WHERE id = ${keyId} AND "orgId" = ${orgId} AND "isRevoked" = false
    `;

    if (keys.length === 0) throw new NotFoundException('API key not found');

    await this.prisma.$executeRaw`
      UPDATE api_keys 
      SET "isRevoked" = true, "revokedAt" = NOW(), "revokedBy" = ${revokedBy}
      WHERE id = ${keyId}
    `;

    await this.ledger.record({
      userId: revokedBy, orgId,
      eventType: 'AUDIT_CREATED' as any,
      entityType: 'ApiKey', entityId: keyId,
      payload: { action: 'REVOKED' },
      ipAddress,
    });

    return { message: 'API key revoked successfully' };
  }

  /**
   * Validate an API key from a scanner request.
   * Called by the scanner auth guard.
   */
  async validateKey(rawKey: string): Promise<{ orgId: string; scopes: string[] } | null> {
    if (!rawKey.startsWith('ncagp_sk_')) return null;

    const prefix = rawKey.slice(0, 12);

    // Find candidates by prefix (fast lookup)
    const candidates = await this.prisma.$queryRaw<any[]>`
      SELECT id, "orgId", "keyHash", scopes, "expiresAt", "isRevoked"
      FROM api_keys
      WHERE "keyPrefix" = ${prefix} AND "isRevoked" = false
    `;

    for (const key of candidates) {
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) continue;

      const matches = await bcrypt.compare(rawKey, key.keyHash);
      if (matches) {
        // Update last used timestamp
        await this.prisma.$executeRaw`
          UPDATE api_keys SET "lastUsedAt" = NOW() WHERE id = ${key.id}
        `;
        return { orgId: key.orgId, scopes: key.scopes };
      }
    }

    return null;
  }
}
