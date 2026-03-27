// ─────────────────────────────────────────────────────────────────
// NCAGP — Auth Module
// File: src/auth/auth.module.ts
// ─────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.get<string>('JWT_PRIVATE_KEY'),
        publicKey: config.get<string>('JWT_PUBLIC_KEY'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '8h',
          issuer: 'ncagp.nic.in',
          audience: 'ncagp-api',
        },
      }),
    }),
    LedgerModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
