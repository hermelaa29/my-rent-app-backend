import type { RequestHandler } from 'express';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express error middleware.
 */
export function asyncHandler(
  fn: (...args: Parameters<RequestHandler>) => unknown,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
