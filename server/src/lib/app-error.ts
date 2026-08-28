export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(msg = 'Resource not found'): AppError {
  return new AppError(404, msg);
}

export function badRequest(msg: string): AppError {
  return new AppError(400, msg);
}

export function unauthorized(msg = 'Unauthorized'): AppError {
  return new AppError(401, msg);
}

export function forbidden(msg = 'Forbidden'): AppError {
  return new AppError(403, msg);
}

export function conflict(msg: string): AppError {
  return new AppError(409, msg);
}
