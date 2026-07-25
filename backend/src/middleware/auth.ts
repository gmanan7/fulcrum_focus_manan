import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError('Authentication token missing');
    }

    const payload = verifyToken(token);
    if (!payload) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRoles = payload.roles || [];
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.userRoles || req.userRoles.length === 0) {
      return next(new ForbiddenError('No roles assigned to user'));
    }

    const hasRole = req.userRoles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return next(new ForbiddenError('Access denied: insufficient permissions'));
    }

    next();
  };
}
