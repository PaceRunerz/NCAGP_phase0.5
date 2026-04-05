// ─────────────────────────────────────────────────────────────────
// NCAGP — MFA Service (TOTP via speakeasy)
// File: src/auth/mfa.service.ts
//
// Flow:
//   1. User calls POST /auth/mfa/setup → gets QR code URL
//   2. User scans QR in Google Authenticator / Authy
//   3. User calls POST /auth/mfa/enable with a valid TOTP code
//   4. MFA is now enforced on their account
//   5. Every login requires TOTP after step 3
//
// ZERO COST: speakeasy + qrcode are free npm packages.
// No external service needed — TOTP runs entirely on your server.
// ─────────────────────────────────────────────────────────────────

import {
  Injectable, BadRequestException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import * as speakeasy from 'speakeasy';
const QRCode = require('qrcode');
import * as crypto from 'crypto';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  /**
   * Step 1: Generate a TOTP secret and return a QR code.
   * The secret is stored (encrypted in prod) but MFA is NOT enabled yet.
   * User must verify with a valid code first (step 2).
   */
  async setupMfa(userId: string): Promise<{
    qrCodeDataUrl: string;
    manualEntryKey: string;
    backupCodes: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled on this account');

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `NCAGP (${user.email})`,
      issuer: 'NIC-NCAGP',
      length: 32,
    });

    // Generate 8 one-time backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );

    // Save secret to user using raw SQL (mfaBackupCodes not in Prisma schema)
    const hashedCodes = backupCodes.map(code =>
      crypto.createHash('sha256').update(code).digest('hex')
    );
    await this.prisma.$executeRaw`
      UPDATE users 
      SET "mfaSecret" = ${secret.base32}, "mfaBackupCodes" = ${hashedCodes}
      WHERE id = ${userId}
    `;

    // Generate QR code as data URL (user scans this with Authenticator)
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    this.logger.log(`MFA setup initiated for user ${userId}`);

    return {
      qrCodeDataUrl,
      manualEntryKey: secret.base32, // For manual entry in authenticator
      backupCodes, // Show these ONCE — user must save them
    };
  }

  /**
   * Step 2: Verify TOTP code and ENABLE MFA on the account.
   * Only called after setup — user must prove their app works.
   */
  async enableMfa(userId: string, orgId: string, totpCode: string, ipAddress: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user?.mfaSecret) throw new BadRequestException('MFA setup not initiated. Call /auth/mfa/setup first.');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!isValid) throw new UnauthorizedException('Invalid TOTP code. Make sure your authenticator is synced.');

    // Enable MFA
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await this.ledger.record({
      userId, orgId,
      eventType: 'USER_LOGIN', // closest event type
      entityType: 'User', entityId: userId,
      payload: { action: 'MFA_ENABLED', method: 'TOTP' },
      ipAddress,
    });

    this.logger.log(`MFA enabled for user ${userId}`);
  }

  /**
   * Disable MFA (requires current TOTP to prevent lockout attacks)
   */
  async disableMfa(userId: string, orgId: string, totpCode: string, ipAddress: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user?.mfaEnabled) throw new BadRequestException('MFA is not enabled');

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret!,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!isValid) throw new UnauthorizedException('Invalid TOTP code');

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

  /**
   * Get MFA status for a user
   */
  async getMfaStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, email: true },
    });
    return {
      mfaEnabled: user?.mfaEnabled ?? false,
      email: user?.email,
    };
  }
}
