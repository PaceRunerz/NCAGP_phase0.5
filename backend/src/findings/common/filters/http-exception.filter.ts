// backend/src/common/filters/http-exception.filter.ts
// Global exception filter for NestJS
// GIGW 3.0 compliance: NEVER returns stack traces or internal errors in production
// All errors logged to Application Insights structured logger

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Safe error codes exposed to clients — everything else becomes INTERNAL_ERROR
const SAFE_ERROR_CODES = new Set([
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'ACCOUNT_DISABLED',
  'MFA_REQUIRED',
  'CAPTCHA_FAILED',
  'CAPTCHA_V2_REQUIRED',
  'TOO_MANY_REQUESTS',
  'VALIDATION_ERROR',
  'FORBIDDEN',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'CONFLICT',
  'BAD_REQUEST',
]);

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  private readonly isDev = process.env.NODE_ENV === 'development';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred. Please try again.';
    let validationErrors: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;

        // Only expose code if it's in the safe list
        if (typeof resp['code'] === 'string' && SAFE_ERROR_CODES.has(resp['code'])) {
          code = resp['code'];
        } else {
          code = this.mapStatusToCode(status);
        }

        // Only expose message for client errors (4xx), not server errors (5xx)
        if (status < 500) {
          message = typeof resp['message'] === 'string'
            ? resp['message']
            : Array.isArray(resp['message'])
            ? 'Validation failed'
            : message;

          // Expose validation errors only for 400
          if (status === 400 && Array.isArray(resp['message'])) {
            validationErrors = resp['message'];
          }
        }

        // Handle lockAt field (account lockout) — safe to expose to user
        if (resp['lockUntil']) {
          // Will be included in body below
        }
      }
    } else if (exception instanceof Error) {
      // Unknown/unhandled error — log full error internally, return generic message
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        this.isDev ? exception.stack : undefined,
        {
          url: request.url,
          method: request.method,
          userId: (request as any).user?.id,
          orgId: (request as any).user?.orgId,
        },
      );
    }

    // Correlation ID for tracing — frontend can show this to support
    const correlationId = request.headers['x-correlation-id'] as string
      || request.headers['x-request-id'] as string
      || this.generateCorrelationId();

    // Structured log for Application Insights
    this.logger.warn(
      `HTTP ${status} ${code} on ${request.method} ${request.url}`,
      {
        correlationId,
        status,
        code,
        userId: (request as any).user?.id,
        orgId: (request as any).user?.orgId,
        ip: request.ip,
      },
    );

    // Build safe response — NEVER include stack trace, internal paths, or DB errors
    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (validationErrors) {
      errorResponse['errors'] = validationErrors;
    }

    // Include lockUntil only for lockout errors
    if (exception instanceof HttpException) {
      const resp = exception.getResponse() as Record<string, unknown>;
      if (resp['lockUntil']) {
        errorResponse['lockUntil'] = resp['lockUntil'];
      }
    }

    // In dev: add a hint but still no stack trace in response body
    if (this.isDev && exception instanceof Error) {
      errorResponse['_devHint'] = exception.message; // never in production
    }

    response.status(status).json(errorResponse);
  }

  private mapStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      428: 'PRECONDITION_REQUIRED',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }

  private generateCorrelationId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
