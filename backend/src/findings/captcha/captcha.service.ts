// backend/src/captcha/captcha.service.ts

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface CaptchaResult {
  success: boolean;
  score?: number;
  action?: string;
  requiresV2Fallback: boolean;
  error?: string;
}

// TEMPORARY DEBUG VALUE
// if dont want to see captcha on screen then change it to 0.5
//if want to use the captcha then change it to 0.99
const V3_SCORE_THRESHOLD = 0.5;

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  private readonly v3SecretKey =
    process.env.RECAPTCHA_V3_SECRET_KEY!;

  private readonly v2SecretKey =
    process.env.RECAPTCHA_V2_SECRET_KEY!;

  async verify(
    token: string,
    version: 'v3' | 'v2',
    expectedAction?: string,
    remoteIp?: string,
  ): Promise<CaptchaResult> {
    try {
      // Development bypass
      if (
        token === 'test-bypass-token' ||
        process.env.SKIP_CAPTCHA === 'true' ||
        process.env.NODE_ENV === 'development'
      ) {
        this.logger.warn('[CAPTCHA] DEV BYPASS — skipping verification');
        return { success: true, requiresV2Fallback: false, score: 1.0 };
      }

      this.logger.warn(
        `[CAPTCHA] Starting verification | version=${version}`,
      );

      if (!token) {
        this.logger.error(
          '[CAPTCHA] No token received from frontend',
        );

        return {
          success: false,
          requiresV2Fallback: false,
          error: 'Missing CAPTCHA token',
        };
      }

      const secretKey =
        version === 'v3'
          ? this.v3SecretKey
          : this.v2SecretKey;

      const params = new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(remoteIp && { remoteip: remoteIp }),
      });

      const { data } = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        params.toString(),
        {
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.warn(
        `[CAPTCHA] Google Response = ${JSON.stringify(data)}`,
      );

      if (!data.success) {
        this.logger.error(
          `[CAPTCHA] Verification Failed = ${JSON.stringify(
            data['error-codes'],
          )}`,
        );

        return {
          success: false,
          requiresV2Fallback: false,
          error: `CAPTCHA verification failed: ${
            data['error-codes']?.join(', ') ?? 'unknown'
          }`,
        };
      }

      if (version === 'v3') {
        const score: number = data.score ?? 0;

        this.logger.warn(
          `[CAPTCHA] SUCCESS | score=${score} | action=${data.action}`,
        );

        if (
          expectedAction &&
          data.action !== expectedAction
        ) {
          this.logger.error(
            `[CAPTCHA] Action Mismatch | expected=${expectedAction} | actual=${data.action}`,
          );

          return {
            success: false,
            score,
            action: data.action,
            requiresV2Fallback: true,
            error: 'CAPTCHA action mismatch',
          };
        }

        if (score < V3_SCORE_THRESHOLD) {
          this.logger.warn(
            `[CAPTCHA] LOW SCORE (${score}) -> REQUIRE V2`,
          );

          return {
            success: false,
            score,
            action: data.action,
            requiresV2Fallback: true,
            error: `Low confidence score: ${score}`,
          };
        }

        this.logger.warn(
          `[CAPTCHA] PASSED | score=${score}`,
        );

        return {
          success: true,
          score,
          action: data.action,
          requiresV2Fallback: false,
        };
      }

      this.logger.warn(
        '[CAPTCHA] V2 CAPTCHA PASSED',
      );

      return {
        success: true,
        requiresV2Fallback: false,
      };
    } catch (error: any) {
      this.logger.error(
        `[CAPTCHA] Verification Request Failed: ${
          error?.message || error
        }`,
      );

      return {
        success: false,
        requiresV2Fallback: false,
        error: 'CAPTCHA service unavailable',
      };
    }
  }
}