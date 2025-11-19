import { Request, Response, NextFunction } from 'express';
import {
  SessionNotFoundError,
  CommandNotFoundError,
  ValidationError,
  TimeoutError,
  ElementNotFoundError,
  MaxSessionsReachedError,
  CommandError
} from '../types/errors';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Map error types to HTTP status codes
  let statusCode = 500;
  let errorType = 'ExecutionError';

  if (error instanceof SessionNotFoundError) {
    statusCode = 404;
    errorType = 'SessionNotFoundError';
  } else if (error instanceof CommandNotFoundError) {
    statusCode = 400;
    errorType = 'CommandNotFoundError';
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    errorType = 'ValidationError';
  } else if (error instanceof TimeoutError) {
    statusCode = 408;
    errorType = 'TimeoutError';
  } else if (error instanceof ElementNotFoundError) {
    statusCode = 404;
    errorType = 'ElementNotFoundError';
  } else if (error instanceof MaxSessionsReachedError) {
    statusCode = 503;
    errorType = 'MaxSessionsReached';
  }

  const errorResponse: CommandError = {
    type: errorType,
    message: error.message,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  res.status(statusCode).json(errorResponse);
}
