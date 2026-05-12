import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/user-role.js';
import { env } from '../utils/env.js';
import { AppError } from '../utils/app-error.js';
import { JWT_ACCESS_TYP, type AccessJwtPayload } from '../modules/auth/auth.types.js';

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

function isAccessJwtPayload(value: unknown): value is AccessJwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.sub === 'string' &&
    (o.role === UserRole.LESSOR || o.role === UserRole.LESSEE) &&
    o.typ === JWT_ACCESS_TYP
  );
}

export const verifyToken: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (token === null || token === '') {
    next(new AppError('Authentication required', 401));
    return;
  }

  try {
    const decoded: unknown = jwt.verify(token, env.jwtSecret);
    if (!isAccessJwtPayload(decoded)) {
      next(new AppError('Invalid token', 401));
      return;
    }
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};

export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user === undefined) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403));
      return;
    }
    next();
  };
}
