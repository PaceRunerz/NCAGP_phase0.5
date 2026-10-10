// ─────────────────────────────────────────────────────────────────
// SYNC — Application Entry Point
// File: src/main.ts
// ─────────────────────────────────────────────────────────────────

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppInsightsLogger } from './common/logger/app-insights.logger';
import { PrismaService } from './prisma/prisma.service'; 

import helmet from 'helmet';

// Initialize the compliant Azure Application Insights logger
const appInsightsLogger = new AppInsightsLogger();
const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  // Use AppInsightsLogger for the entire NestJS instance
  const app = await NestFactory.create(AppModule, {
    logger: appInsightsLogger,
  });

  // Enable shutdown hooks to handle closing cleanly
  app.enableShutdownHooks();

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

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

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
  
  // Get prisma from the app context
  const prismaService = app.get(PrismaService);

  // ── Health endpoints — no auth, no guards ─────────────────────
  app.use('/api/health/live', (req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/health/ready', async (req: any, res: any) => {
    try {
      await prismaService.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() });
    }
  });
  // ──────────────────────────────────────────────────────────────
  
  await app.listen(port, '0.0.0.0');

  bootstrapLogger.log(`🛡️  SYNC API running on: http://localhost:${port}/api`);
  bootstrapLogger.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}

// Ensure pending telemetry is flushed to Azure safely on shutdown
process.on('beforeExit', async () => {
  await appInsightsLogger.flush();
});

bootstrap().catch((err) => {
  bootstrapLogger.error('Failed to start application', err);
  process.exit(1);
});