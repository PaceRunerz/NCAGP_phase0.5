

import { LoggerService, Injectable } from '@nestjs/common';
import * as appInsights from 'applicationinsights';

@Injectable()
export class AppInsightsLogger implements LoggerService {
  private readonly client: appInsights.TelemetryClient | null;
  private readonly isDev = process.env.NODE_ENV === 'development';
  private context: string = 'SYNC';

  constructor() {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (connectionString) {
      appInsights
        .setup(connectionString)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(false) 
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(true)
        .start();

      this.client = appInsights.defaultClient;

      // Set cloud role name for App Insights dashboards
      this.client.context.tags[this.client.context.keys.cloudRole] = 'sync-api';
      this.client.context.tags[this.client.context.keys.cloudRoleInstance] =
        process.env.WEBSITE_INSTANCE_ID ?? 'local';
    } else {
      this.client = null;
      if (!this.isDev) {
        console.warn('[SYNC] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled');
      }
    }
  }

  setContext(context: string) {
    this.context = context;
    return this;
  }

  log(message: string, properties?: Record<string, unknown>) {
    // 🔊 SILENCER REMOVED
    console.log(`[${this.context}] ${message}`);
    this.client?.trackTrace({
      message: `[${this.context}] ${message}`,
      severity: appInsights.Contracts.SeverityLevel.Information,
      properties: { context: this.context, ...properties },
    });
  }

  error(message: string, trace?: string, properties?: Record<string, unknown>) {
    console.error(`[${this.context}] ERROR: ${message}`, trace);
    
    this.client?.trackTrace({
      message: `[${this.context}] ERROR: ${message}`,
      severity: appInsights.Contracts.SeverityLevel.Error,
      properties: { context: this.context, trace, ...properties },
    });
    // Also track as exception for alerting
    if (trace) {
      const err = new Error(message);
      err.stack = trace;
      this.client?.trackException({
        exception: err,
        properties: { context: this.context, ...properties },
      });
    }
  }

  warn(message: string, properties?: Record<string, unknown>) {
    console.warn(`[${this.context}] WARN: ${message}`);
    this.client?.trackTrace({
      message: `[${this.context}] WARN: ${message}`,
      severity: appInsights.Contracts.SeverityLevel.Warning,
      properties: { context: this.context, ...properties },
    });
  }

  debug(message: string, properties?: Record<string, unknown>) {
    console.debug(`[${this.context}] DEBUG: ${message}`);
    // Only send debug to App Insights in development
    if (this.isDev && this.client) {
      this.client.trackTrace({
        message: `[${this.context}] DEBUG: ${message}`,
        severity: appInsights.Contracts.SeverityLevel.Verbose,
        properties: { context: this.context, ...properties },
      });
    }
  }

  verbose(message: string, properties?: Record<string, unknown>) {
    console.log(`[${this.context}] VERBOSE: ${message}`);
  }

  /**
   * Track a security event — stored with high severity for CERT-In audit trail
   * Use for: login failures, lockouts, RLS violations, invalid tokens
   */
  trackSecurityEvent(
    eventName: string,
    properties: Record<string, unknown>,
  ) {
    this.client?.trackEvent({
      name: `SYNC.Security.${eventName}`,
      properties: {
        context: this.context,
        severity: 'security',
        timestamp: new Date().toISOString(),
        ...properties,
      },
    });
    this.warn(`SECURITY EVENT: ${eventName}`, properties);
  }

  /**
   * Flush all pending telemetry — call this on app shutdown
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.flush({ callback: () => resolve() });
      } else {
        resolve();
      }
    });
  }
}