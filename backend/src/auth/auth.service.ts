// ─────────────────────────────────────────────────────────────────
// NCAGP — Auth Service
// File: src/auth/auth.service.ts
// ─────────────────────────────────────────────────────────────────

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';      xfvv
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private ledger: LedgerService,
  ) {}

  /**
   * Step 1: Validate credentials — returns partial token (no MFA yet)
   */
  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { org: { select: { id: true, name: true, dataAccessScope: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account locked. Try again in ${minutesLeft} minutes.`,
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Increment failed attempts
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
        throw new ForbiddenException(
          `Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts.`,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // If MFA enabled, return a partial token (mfaVerified: false)
    // Frontend must call /auth/mfa/verify to get a full token
    const sessionId = crypto.randomUUID();
    const mfaVerified = !user.mfaEnabled; // Auto-verified if MFA not set up

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

  /**
   * Step 2 (if MFA enabled): Verify TOTP code and issue full token
   */
  async verifyMfa(userId: string, orgId: string, totpCode: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.mfaSecret) {
      throw new BadRequestException('MFA not configured for this user');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1, // Allow 30-second clock drift
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
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Upgrade session to MFA-verified
    const newToken = await this.generateToken(user, sessionId, true);

    // Update session
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    await this.prisma.session.updateMany({
      where: { token: tokenHash, userId },
      data: { expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
    });

    return { accessToken: newToken };
  }

  /**
   * Logout — revoke session
   */
  async logout(userId: string, sessionId: string, ipAddress: string) {
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

  // ── Private helpers ────────────────────────────────────────────

  private async generateToken(
    user: any,
    sessionId: string,
    mfaVerified: boolean,
  ): Promise<string> {
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

  private async createSession(
    userId: string,
    sessionId: string,
    token: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(sessionId)
      .digest('hex');

    // Remove old sessions for this user (keep last 3)
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
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      },
    });
  }
}
