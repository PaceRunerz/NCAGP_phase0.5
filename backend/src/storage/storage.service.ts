// ─────────────────────────────────────────────────────────────────
// NCAGP — Storage Service (MinIO / NIC Object Store)
// File: src/storage/storage.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

interface UploadOptions {
  path: string;
  buffer: Buffer;
  contentType: string;
  encryptionKeyId?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    const endpointRaw = this.config.get<string>('STORAGE_ENDPOINT') || 'http://localhost:9000';
    const endpoint = new URL(endpointRaw);

    this.client = new Minio.Client({
      endPoint: endpoint.hostname,
      port: parseInt(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 80),
      useSSL: endpoint.protocol === 'https:',
      accessKey: this.config.get<string>('STORAGE_ACCESS_KEY') || 'minioadmin',
      secretKey: this.config.get<string>('STORAGE_SECRET_KEY') || 'minioadmin',
    });

    this.bucket = this.config.get<string>('STORAGE_BUCKET') || 'ncagp-evidence';
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'ap-south-1');
        this.logger.log(`Bucket '${this.bucket}' created`);
      } else {
        this.logger.log(`Bucket '${this.bucket}' ready`);
      }
    } catch (err) {
      this.logger.error('Storage init failed — is MinIO running?', err);
    }
  }

  async upload(options: UploadOptions): Promise<{ path: string }> {
    const metaHeaders: Record<string, string> = {
      'Content-Type': options.contentType,
      'x-amz-server-side-encryption': 'AES256',
      ...options.metadata,
    };

    await this.client.putObject(
      this.bucket,
      options.path,
      options.buffer,
      options.buffer.length,
      metaHeaders,
    );

    this.logger.debug(`Uploaded: ${options.path} (${options.buffer.length} bytes)`);
    return { path: options.path };
  }

  async download(path: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, path);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async generatePresignedUrl(path: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, path, expirySeconds);
  }

  async objectExists(path: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, path);
      return true;
    } catch {
      return false;
    }
  }
}
