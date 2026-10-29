import type { Request } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../utils/httpError';

/** Parses and validates a query string, converting Zod failures into 400s. */
export function parseQuery<T>(schema: ZodType<T>, req: Request): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw HttpError.badRequest(
      'Invalid query parameters.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    );
  }
  return result.data;
}
