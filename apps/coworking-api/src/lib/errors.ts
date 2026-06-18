import type { Context } from 'hono';
import { ZodError, type ZodType } from 'zod';

/** An error that maps directly to an HTTP response. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, code = 'bad_request', details?: unknown): HttpError =>
  new HttpError(400, code, message, details);
export const unauthorized = (message = 'unauthorized'): HttpError =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'forbidden'): HttpError =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'not found'): HttpError =>
  new HttpError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict'): HttpError =>
  new HttpError(409, code, message);
export const paymentRequired = (message: string): HttpError =>
  new HttpError(402, 'premium_required', message);

/** Validate `data` against a zod schema, throwing a 400 HttpError on failure. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'validation_error', 'request validation failed', result.error.issues);
  }
  return result.data;
}

/** True for a Postgres unique-violation error (SQLSTATE 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

/**
 * Hono onError handler. Builds the JSON error envelope the SDK expects:
 * `{ error: { message, code, details? } }`. Uses a raw Response so the status
 * code can be dynamic without fighting Hono's StatusCode literal types.
 */
export function errorHandler(err: Error, _c: Context): Response {
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  if (err instanceof HttpError) {
    return json(err.status, {
      error: { message: err.message, code: err.code, details: err.details ?? undefined },
    });
  }
  if (err instanceof ZodError) {
    return json(400, {
      error: { message: 'request validation failed', code: 'validation_error', details: err.issues },
    });
  }
  console.error(JSON.stringify({ message: 'coworking.error', error: err.message, stack: err.stack }));
  return json(500, { error: { message: 'internal server error', code: 'internal' } });
}
