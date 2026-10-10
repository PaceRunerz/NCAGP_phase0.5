import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LedgerService } from '../ledger/ledger.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';

// Comprehensive unit tests for AuthService

describe('AuthService', () => {
  let module: TestingModule;
  let authService: AuthService;
  let prisma: any;
  let jwtService: any;
  let ledger: any;
  let configService: any;

  // Generate an ephemeral RSA keypair for RS256 signing/verifying
  const { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      session: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(async (payload: any) => jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' })),
    };

    ledger = { record: jest.fn() };

    configService = { get: jest.fn((key: string) => (key === 'JWT_PUBLIC_KEY' ? PUBLIC_KEY : undefined)) };

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: LedgerService, useValue: ledger },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Login', () => {
    const baseUser = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'hashed-password',
      isActive: true,
      failedAttempts: 0,
      mfaEnabled: false,
      orgId: 'org-1',
      name: 'Alice',
      role: 'ADMIN',
      org: { id: 'org-1', name: 'Org', dataAccessScope: [] },
    };

    it('valid credentials -> returns accessToken', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      prisma.session.create.mockResolvedValue({ id: 's1' });
      prisma.user.update.mockResolvedValue({});

      const res = await authService.login('user@example.com', 'password', '1.2.3.4', 'ua');

      expect(res).toHaveProperty('accessToken');
      expect(res.requiresMfa).toBe(false);
      expect(res.user).toMatchObject({ id: baseUser.id, email: baseUser.email, role: baseUser.role });

      // verify token signature and payload
      const decoded = jwt.verify(res.accessToken, PUBLIC_KEY, { algorithms: ['RS256'] }) as any;
      expect(decoded.sub).toBe(baseUser.id);
      expect(decoded.orgId).toBe(baseUser.orgId);
      expect(decoded.role).toBe(baseUser.role);
    });

    it('wrong password -> throws UnauthorizedException and increments attempts', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, failedAttempts: 0 });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({});

      await expect(
        authService.login('user@example.com', 'bad', '1.2.3.4', 'ua'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('account locked after 5 failed attempts -> throws ForbiddenException', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, failedAttempts: 4 });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({});

      await expect(
        authService.login('user@example.com', 'bad', '1.2.3.4', 'ua'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(ledger.record).toHaveBeenCalled();
    });

    it('non-existent email -> throws UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        authService.login('missing@example.com', 'password', '1.2.3.4', 'ua'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('JWT token generation', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      orgId: 'org-1',
      org: { dataAccessScope: [] },
    };

    it('token generated with correct payload and signed RS256', async () => {
      const sessionId = 'sess-123';
      const token = await (authService as any).generateToken(user, sessionId, true);

      // verify signature and payload
      const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }) as any;
      expect(decoded.sub).toBe(user.id);
      expect(decoded.orgId).toBe(user.orgId);
      expect(decoded.role).toBe(user.role);
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.mfaVerified).toBe(true);
    });
  });

  describe('MFA', () => {
    const userBase = {
      id: 'user-2',
      email: 'mfa@example.com',
      passwordHash: 'hashed',
      isActive: true,
      failedAttempts: 0,
      orgId: 'org-2',
      name: 'Bob',
      role: 'OBSERVER',
      org: { id: 'org-2', name: 'Org2', dataAccessScope: [] },
    };

    it('MFA disabled -> login returns full token directly', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...userBase, mfaEnabled: false });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      prisma.session.create.mockResolvedValue({ id: 's2' });

      const res = await authService.login('mfa@example.com', 'pw', 'ip', 'ua');
      expect(res.requiresMfa).toBe(false);

      const decoded = jwt.verify(res.accessToken, PUBLIC_KEY, { algorithms: ['RS256'] }) as any;
      expect(decoded.mfaVerified).toBe(true);
    });

    it('MFA enabled -> login returns partial token and requiresMfa true', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...userBase, mfaEnabled: true });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      prisma.session.create.mockResolvedValue({ id: 's3' });

      const res = await authService.login('mfa@example.com', 'pw', 'ip', 'ua');
      expect(res.requiresMfa).toBe(true);

      const decoded = jwt.verify(res.accessToken, PUBLIC_KEY, { algorithms: ['RS256'] }) as any;
      expect(decoded.mfaVerified).toBe(false);
    });

    it('valid TOTP code -> returns full access token', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userBase.id, mfaSecret: 'BASE32SECRET' });
      jest.spyOn(speakeasy.totp, 'verify' as any).mockReturnValue(true);
      prisma.session.updateMany.mockResolvedValue({});

      const token = await authService.verifyMfa(userBase.id, 'org-2', '123456', 'sess-abc');
      expect(token).toHaveProperty('accessToken');
      expect(jwt.verify(token.accessToken, PUBLIC_KEY, { algorithms: ['RS256'] })).toBeDefined();
    });

    it('invalid TOTP code -> throws UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userBase.id, mfaSecret: 'BASE32SECRET' });
      jest.spyOn(speakeasy.totp, 'verify' as any).mockReturnValue(false);

      await expect(authService.verifyMfa(userBase.id, 'org-2', '000000', 'sess-abc')).rejects.toThrow(UnauthorizedException);
      expect(ledger.record).toHaveBeenCalled();
    });
  });

  describe('Session management', () => {
    it('logout revokes session in DB', async () => {
      const userId = 'user-logout';
      const sessionId = 'sess-logout';
      const ip = '1.2.3.4';

      prisma.session.deleteMany.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ id: userId, orgId: 'org-x' });

      await authService.logout(userId, sessionId, ip);

      const expectedHash = crypto.createHash('sha256').update(sessionId).digest('hex');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { token: expectedHash, userId } });
      expect(ledger.record).toHaveBeenCalled();
    });

    it('revoked session on next request -> JwtStrategy.validate throws UnauthorizedException', async () => {
      const payload: any = {
        sub: 'user-1',
        email: 'a@b.com',
        role: 'ADMIN',
        orgId: 'org-1',
        dataAccessScope: [],
        mfaVerified: true,
        sessionId: 'sess-xyz',
      };

      // Simulate revoked (no session found)
      prisma.session.findFirst.mockResolvedValue(null);

      const strategy = new JwtStrategy(configService as any, prisma as any);
      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Account lockout', () => {
    it('5 failed logins -> account locked', async () => {
      const u = { ...{ id: 'locked-user', email: 'x@x', passwordHash: 'h' }, failedAttempts: 4 };
      prisma.user.findUnique.mockResolvedValue(u);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({});

      await expect(authService.login(u.email, 'bad', 'ip', 'ua')).rejects.toThrow(ForbiddenException);
      expect(ledger.record).toHaveBeenCalled();
    });

    it('locked account -> throws with lockout message', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60000); // 10 minutes in future
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, lockedUntil });

      await expect(authService.login('user@example.com', 'pw', 'ip', 'ua')).rejects.toThrow(ForbiddenException);
    });

    it('lockout expires after 15 minutes -> allow login', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, lockedUntil: new Date(Date.now() - 1000) });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      prisma.session.create.mockResolvedValue({ id: 's4' });

      const res = await authService.login('user@example.com', 'pw', 'ip', 'ua');
      expect(res).toHaveProperty('accessToken');
    });
  });
});
