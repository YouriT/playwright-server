import { Request, Response, NextFunction } from 'express';
import {
  SessionNotFoundError,
  CommandNotFoundError,
  ValidationError,
  TimeoutError,
  ElementNotFoundError,
  MaxSessionsReachedError,
  ProxyValidationError,
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
  let details: any = undefined;

  if (error instanceof SessionNotFoundError) {
    statusCode = 404;
    errorType = 'SessionNotFoundError';
  } else if (error instanceof CommandNotFoundError) {
    statusCode = 400;
    errorType = 'CommandNotFoundError';
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    errorType = 'ValidationError';
  } else if (error instanceof ProxyValidationError) {
    statusCode = 400;
    errorType = 'ProxyValidationError';
    // Include validation details for proxy errors
    details = error.details;
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
    details: details || (process.env.NODE_ENV === 'development' ? error.stack : undefined)
  };

  res.status(statusCode).json(errorResponse);
}
