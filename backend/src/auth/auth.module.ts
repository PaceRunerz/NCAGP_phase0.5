import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport'; 
import { JwtStrategy } from './jwt.strategy'; 
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AlertsModule } from '../alerts/alerts.module';
import { CaptchaModule } from '../captcha/captcha.module';
import { IncidentModule } from '../incident/incident.module';

@Module({
imports: [
PrismaModule,
LedgerModule,
AlertsModule,
CaptchaModule,
IncidentModule, 
PassportModule, 
JwtModule.register({
global: true,
secret: process.env.JWT_SECRET || 'super_secret_ncagp_key_2026_do_not_share',
signOptions: { expiresIn: '8h' },
}),
],
controllers: [AuthController],
providers: [
AuthService,
JwtStrategy 
],
})
export class AuthModule {}
