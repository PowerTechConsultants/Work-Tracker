export class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
export function notFound(msg = 'Resource not found') {
    return new AppError(404, msg);
}
export function badRequest(msg) {
    return new AppError(400, msg);
}
export function unauthorized(msg = 'Unauthorized') {
    return new AppError(401, msg);
}
export function forbidden(msg = 'Forbidden') {
    return new AppError(403, msg);
}
export function conflict(msg) {
    return new AppError(409, msg);
}
