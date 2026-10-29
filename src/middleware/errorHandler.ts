import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    new HttpError(404, `Route ${req.method} ${req.originalUrl} does not exist.`, 'ROUTE_NOT_FOUND'),
  );
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Something went wrong while processing the request.';
  let details: unknown;

  if (error instanceof HttpError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed.';
    details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    status = error.code === 'P2025' ? 404 : 500;
    code = `PRISMA_${error.code}`;
    message =
      error.code === 'P2025'
        ? 'The requested record does not exist.'
        : 'A database error occurred.';
    details = env.isProduction ? undefined : { meta: error.meta };
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'The database is not reachable. Please retry shortly.';
  }

  if (status >= 500) {
    logger.error('request.failed', {
      method: req.method,
      path: req.originalUrl,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  const body: ErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      ...(!env.isProduction && error instanceof Error ? { stack: error.stack } : {}),
    },
  };

  res.status(status).json(body);
}
