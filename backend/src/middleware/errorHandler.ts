import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  logger.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // PostgreSQL unique violation error handling
  if (err.code === '23505') {
    res.status(409).json({
      error: 'Conflict: Record already exists with these unique fields',
    });
    return;
  }

  // PostgreSQL foreign key violation error handling
  if (err.code === '23503') {
    res.status(400).json({
      error: 'Bad request: Referenced record does not exist',
    });
    return;
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  });
}
