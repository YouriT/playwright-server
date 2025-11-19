export interface CommandError {
  type: string;
  message: string;
  details?: any;
}

// Custom error classes
export class SessionNotFoundError extends Error {
  constructor(message: string = 'Session not found or has expired') {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}

export class CommandNotFoundError extends Error {
  constructor(command: string) {
    super(`Command '${command}' is not registered`);
    this.name = 'CommandNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Command execution exceeded timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ElementNotFoundError extends Error {
  constructor(selector: string) {
    super(`Element matching selector '${selector}' not found`);
    this.name = 'ElementNotFoundError';
  }
}

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export class MaxSessionsReachedError extends Error {
  constructor(limit: number) {
    super(`Maximum concurrent sessions limit reached (${limit}). Please try again later.`);
    this.name = 'MaxSessionsReachedError';
  }
}
