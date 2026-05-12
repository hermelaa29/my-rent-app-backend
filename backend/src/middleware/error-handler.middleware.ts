import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Internal server error';
}

function getErrorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

export const errorHandlerMiddleware: ErrorRequestHandler = (err, _req, res, next) => {
  void next;
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: err.flatten(),
      },
    });
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError
      ? err.message
      : process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : getErrorMessage(err);

  if (statusCode >= 500) {
    console.error(err);
  }

  const stack =
    process.env.NODE_ENV !== 'production' && !(err instanceof AppError)
      ? getErrorStack(err)
      : undefined;

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(stack !== undefined ? { stack } : {}),
    },
  });
};
