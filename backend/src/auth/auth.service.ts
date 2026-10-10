import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException, // <-- Added this
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AlertsService } from '../alerts/alerts.service';
import { CaptchaService } from '../captcha/captcha.service';
import { IncidentService, IncidentType, IncidentSeverity } from '../incident/incident.service';
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
    private alertsService: AlertsService,
    private captchaService: CaptchaService,
    private readonly incidentService: IncidentService,
  ) {}

  async login(
    email: string,
    password: string,
    recaptchaToken: string | undefined,
    recaptchaVersion: 'v2' | 'v3' | undefined,
    ipAddress: string,
    userAgent: string,
  ) {
    // ── CAPTCHA VERIFICATION ──────────────────────────────────────
    if (!recaptchaToken) {
      throw new UnauthorizedException({
        code: 'CAPTCHA_REQUIRED',
        message: 'Captcha token missing',
      });
    }

    const captchaResult = await this.captchaService.verify(
      recaptchaToken,
      recaptchaVersion ?? 'v3',
      'login',
      ipAddress,
    );

    if (!captchaResult.success) {
      if (captchaResult.requiresV2Fallback) {
        throw new HttpException(
          {
            code: 'CAPTCHA_V2_REQUIRED',
            message: 'Please complete human verification',
          },
          HttpStatus.PRECONDITION_REQUIRED,
        );
      }

      throw new UnauthorizedException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA verification failed',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { org: { select: { id: true, name: true, dataAccessScope: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account locked. Try again in ${minutesLeft} minutes.`);
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

        await this.incidentService.checkAndReport('failed_logins', {
          count: newAttempts,
          userId: user.id,
          orgId: user.orgId,
          sourceIp: ipAddress,
          details: `Account ${user.email} locked after ${newAttempts} failed attempts`,
        });

        throw new ForbiddenException(`Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts.`);
      }

      throw new UnauthorizedException('Invalid credentials');
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

    void this.alertsService.sendLoginBreachAlert({
      id:        user.id,
      name:      user.name,
      email:     user.email,
      orgId:     user.orgId,
      role:      user.role,
      loginTime: new Date(),
    }).catch((err) => {
      this.logger.error(`Failed to send login alert for ${user.email}: ${err.message}`);
    });

    return {
      accessToken: token,
      requiresMfa: user.mfaEnabled && !mfaVerified,
      user: {
        id:      user.id,
        name:    user.name,
        email:   user.email,
        role:    user.role,
        orgId:   user.orgId,
        orgName: user.org.name,
      },
    };
  }

  async verifyMfa(userId: string, orgId: string, totpCode: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.mfaSecret) {
      throw new BadRequestException('MFA not configured for this user');
    }

    const isValid = speakeasy.totp.verify({
      secret:   user.mfaSecret,
      encoding: 'base32',
      token:    totpCode,
      window:   1,
    });

    if (!isValid) {
      await this.ledger.record({
        userId,
        orgId,
        eventType: 'USER_MFA_BYPASS_ATTEMPT',
        entityType: 'User',
        entityId:  userId,
        payload:   { reason: 'Invalid TOTP code' },
        ipAddress: 'unknown',
      });
      throw new UnauthorizedException('Invalid MFA code');
    }

    const newToken = await this.generateToken(user, sessionId, true);
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    await this.prisma.session.updateMany({
      where: { token: tokenHash, userId },
      data:  { expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
    });

    return { accessToken: newToken };
  }

  async logout(userId: string, sessionId: string, ipAddress: string) {
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');

    await this.prisma.session.deleteMany({
      where: { token: tokenHash, userId },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.ledger.record({
        userId,
        orgId:     user.orgId,
        eventType: 'USER_LOGOUT',
        entityType: 'User',
        entityId:  userId,
        payload:   {},
        ipAddress,
      });
    }

    return { message: 'Logged out successfully' };
  }

  private async generateToken(
    user: any,
    sessionId: string,
    mfaVerified: boolean,
  ): Promise<string> {
    const payload = {
      sub:             user.id,
      email:           user.email,
      role:            user.role,
      orgId:           user.orgId,
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
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');

    const sessions = await this.prisma.session.findMany({
      where:   { userId },
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
        token:     tokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
  }


  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async initMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate a secure MFA secret using the user's email for the authenticator app label
    const secret = speakeasy.generateSecret({
      name: `SYNC Platform (${user.email})`,
    });

    // Save the secret temporarily to the DB
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }
}