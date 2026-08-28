import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';

const MIN_COMPRESS_LENGTH = 1024;

const COMPRESSIBLE_PATTERNS = [
  /^text\//,
  /^application\/json/,
  /^application\/javascript/,
  /^application\/xml/,
  /^application\/.*\+json$/,
  /^application\/.*\+xml$/,
];

function isCompressible(contentType: string): boolean {
  return COMPRESSIBLE_PATTERNS.some((p) => p.test(contentType));
}

export function compressMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (res.getHeader('Content-Encoding')) return next();
    if (req.method === 'HEAD') return next();

    const contentType = (res.getHeader('Content-Type') as string) || '';
    if (!isCompressible(contentType)) return next();

    const acceptEncoding = (req.headers['accept-encoding'] as string) || '';
    let encoding: string | null = null;
    if (/\bbr\b/i.test(acceptEncoding)) encoding = 'br';
    else if (/\bgzip\b/i.test(acceptEncoding)) encoding = 'gzip';
    else if (/\bdeflate\b/i.test(acceptEncoding)) encoding = 'deflate';
    if (!encoding) return next();

    const _end = res.end.bind(res);
    const chunks: Buffer[] = [];

    (res as any).write = (chunk: any) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };

    (res as any).end = (chunk?: any) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);

      if (body.length < MIN_COMPRESS_LENGTH) {
        res.removeHeader('Content-Encoding');
        res.setHeader('Content-Length', body.length);
        return _end(body);
      }

      try {
        let compressed: Buffer;
        if (encoding === 'br') {
          compressed = zlib.brotliCompressSync(body, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
          });
        } else {
          compressed = zlib.gzipSync(body, { level: 6 });
        }
        res.setHeader('Content-Encoding', encoding);
        res.setHeader('Content-Length', compressed.length);
        res.setHeader('Vary', 'Accept-Encoding');
        _end(compressed);
      } catch {
        res.removeHeader('Content-Encoding');
        res.removeHeader('Vary');
        res.setHeader('Content-Length', body.length);
        _end(body);
      }
    };

    next();
  };
}
