import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/app-error';

const SAFE_MESSAGES: Record<string, string> = {
  'UNIQUE constraint failed: users.email': 'A user with this email already exists',
  'UNIQUE constraint failed: users.employee_id': 'Employee ID already exists',
  'FOREIGN KEY constraint failed': 'Referenced record not found',
  'NOT NULL constraint failed': 'Required field is missing',
  'CHECK constraint failed': 'Invalid data provided',
};

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  let status: number;
  if (err.name === 'CircuitBreakerOpenError') {
    status = 503;
  } else if (err instanceof AppError) {
    status = err.statusCode;
  } else {
    status = 500;
  }
  const reqId = (req as any).id || '-';

  if (status >= 500) {
    console.error(`[ERROR] [${reqId}] ${status} - ${err.message}`, err);
  } else {
    console.error(`[ERROR] [${reqId}] ${status} - ${err.message}`);
  }

  let message: string;
  if (status === 503) {
    message = 'Service temporarily unavailable';
  } else if (status >= 500) {
    message = 'Internal server error';
  } else if (err instanceof AppError) {
    message = err.message;
  } else {
    const safeKey = Object.keys(SAFE_MESSAGES).find((k) => err.message.includes(k));
    message = (safeKey && SAFE_MESSAGES[safeKey]) || 'An error occurred';
  }

  res.status(status).json({ error: message, requestId: reqId });
}
