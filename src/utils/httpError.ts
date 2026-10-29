export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code = 'HTTP_ERROR', details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, message, 'BAD_REQUEST', details);
  }

  static notFound(message: string, details?: unknown): HttpError {
    return new HttpError(404, message, 'NOT_FOUND', details);
  }

  static unprocessable(message: string, details?: unknown): HttpError {
    return new HttpError(422, message, 'UNPROCESSABLE_ENTITY', details);
  }

  static serviceUnavailable(message: string, details?: unknown): HttpError {
    return new HttpError(503, message, 'SERVICE_UNAVAILABLE', details);
  }
}
