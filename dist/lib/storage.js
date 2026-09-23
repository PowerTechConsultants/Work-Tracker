import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
class LocalStorage {
    baseDir;
    constructor() {
        this.baseDir = path.resolve(config.uploadDir);
    }
    sanitizeKey(key) {
        const normalized = path.posix.normalize(key).replace(/^(\.\.[/\\])+/, '');
        if (normalized.includes('..'))
            throw new Error('Invalid file key');
        return normalized;
    }
    async upload(key, buffer, _mimeType) {
        const safeKey = this.sanitizeKey(key);
        const fullPath = path.join(this.baseDir, safeKey);
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, buffer);
        const parts = safeKey.split('/');
        const urlPath = `/api/v1/files/${parts.join('/')}`;
        return { url: urlPath, size: buffer.length };
    }
    async download(key) {
        const safeKey = this.sanitizeKey(key);
        const fullPath = path.join(this.baseDir, safeKey);
        return await fs.readFile(fullPath);
    }
    async delete(key) {
        const safeKey = this.sanitizeKey(key);
        const fullPath = path.join(this.baseDir, safeKey);
        await fs.unlink(fullPath);
    }
    async getSignedUrl(key, _expiresIn) {
        const safeKey = this.sanitizeKey(key);
        const parts = safeKey.split('/');
        return `/api/v1/files/${parts.join('/')}`;
    }
}
class S3Storage {
    bucket;
    region;
    accessKeyId;
    secretAccessKey;
    endpoint;
    client = null;
    constructor() {
        this.bucket = process.env.S3_BUCKET || '';
        this.region = process.env.S3_REGION || 'us-east-1';
        this.accessKeyId = process.env.S3_ACCESS_KEY || '';
        this.secretAccessKey = process.env.S3_SECRET_KEY || '';
        this.endpoint = process.env.S3_ENDPOINT || undefined;
    }
    async getClient() {
        if (this.client)
            return this.client;
        const { S3Client } = await import('@aws-sdk/client-s3');
        this.client = new S3Client({
            region: this.region,
            endpoint: this.endpoint,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
            },
        });
        return this.client;
    }
    async upload(key, buffer, mimeType) {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const client = await this.getClient();
        await client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        }));
        const url = this.endpoint
            ? `${this.endpoint}/${this.bucket}/${key}`
            : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
        return { url, size: buffer.length };
    }
    async download(key) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const client = await this.getClient();
        const resp = await client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
        const stream = resp.Body;
        if (!stream)
            throw new Error('Empty response body');
        const chunks = [];
        const reader = stream.transformToWebStream().getReader();
        let done = false;
        while (!done) {
            const result = await reader.read();
            done = result.done;
            if (result.value)
                chunks.push(result.value);
        }
        return Buffer.concat(chunks);
    }
    async delete(key) {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        const client = await this.getClient();
        await client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }
    async getSignedUrl(key, expiresIn = 3600) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const client = await this.getClient();
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        return getSignedUrl(client, command, { expiresIn });
    }
}
let cachedProvider = null;
export function getStorage() {
    if (cachedProvider)
        return cachedProvider;
    const provider = process.env.STORAGE_PROVIDER === 's3' ? new S3Storage() : new LocalStorage();
    cachedProvider = provider;
    return provider;
}
