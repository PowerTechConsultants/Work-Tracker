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
function isCompressible(contentType) {
    return COMPRESSIBLE_PATTERNS.some((p) => p.test(contentType));
}
export function compressMiddleware() {
    return (req, res, next) => {
        if (res.getHeader('Content-Encoding'))
            return next();
        if (req.method === 'HEAD')
            return next();
        const acceptEncoding = req.headers['accept-encoding'] || '';
        let encoding = null;
        if (/\bbr\b/i.test(acceptEncoding))
            encoding = 'br';
        else if (/\bgzip\b/i.test(acceptEncoding))
            encoding = 'gzip';
        else if (/\bdeflate\b/i.test(acceptEncoding))
            encoding = 'deflate';
        if (!encoding)
            return next();
        const _end = res.end.bind(res);
        res.end = function (chunk, ...args) {
            const contentType = res.getHeader('Content-Type') || '';
            const body = chunk ? (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)) : Buffer.alloc(0);
            if (!isCompressible(contentType) || body.length < MIN_COMPRESS_LENGTH) {
                res.removeHeader('Content-Encoding');
                res.setHeader('Content-Length', body.length);
                return _end(chunk, ...args);
            }
            try {
                let compressed;
                if (encoding === 'br') {
                    compressed = zlib.brotliCompressSync(body, {
                        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
                    });
                }
                else if (encoding === 'deflate') {
                    compressed = zlib.deflateSync(body);
                }
                else {
                    compressed = zlib.gzipSync(body, { level: 6 });
                }
                res.setHeader('Content-Encoding', encoding);
                res.setHeader('Content-Length', compressed.length);
                res.setHeader('Vary', 'Accept-Encoding');
                return _end(compressed, ...args);
            }
            catch {
                res.removeHeader('Content-Encoding');
                res.removeHeader('Vary');
                res.setHeader('Content-Length', body.length);
                return _end(chunk, ...args);
            }
        };
        next();
    };
}
