// ─────────────────────────────────────────────────────────────────
// NCAGP — Application Entry Point
// File: src/main.ts
// ─────────────────────────────────────────────────────────────────

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // ── Security headers (government-grade) ──────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );

  // ── CORS — restrict to your frontend origin in prod ──────────
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  // ── Global validation pipe ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Strip unknown fields
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── API prefix ───────────────────────────────────────────────
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🛡️  NCAGP API running on: http://localhost:${port}/api`);
  logger.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((err) => {
  logger.error('Failed to start application', err);
  process.exit(1);
});
