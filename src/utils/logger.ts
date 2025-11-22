import pino from 'pino';
import os from 'os';
import { SessionLogEntry } from '../types/command';

// ECS log level to numeric severity mapping (RFC 5424 syslog)
const LOG_LEVEL_SEVERITY: Record<string, number> = {
  trace: 7, // Debug
  debug: 7, // Debug
  info: 6, // Informational
  warn: 4, // Warning
  error: 3, // Error
  fatal: 2 // Critical
};

// Proxy redaction paths for Pino redact configuration
const PROXY_REDACTION_PATHS = [
  // Direct proxy config
  'proxy.username',
  'proxy.password',
  'proxy.server',

  // Nested configurations
  'proxyConfig.username',
  'proxyConfig.password',
  'proxyConfig.server',

  // Wildcard patterns for dynamic structures
  '*.proxy.username',
  '*.proxy.password',
  '*.proxy.server',
  '*.proxyConfig.username',
  '*.proxyConfig.password',
  '*.proxyConfig.server',

  // API request parameters
  'params.proxy.username',
  'params.proxy.password',
  'params.proxy.server'
];

/**
 * Mask credentials in proxy server URL for safe logging
 */
function maskProxyServerUrl(url: string): string {
  if (!url || typeof url !== 'string') return '[REDACTED]';

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '[USER]';
      parsed.password = '';
      return parsed.toString();
    }
    return url;
  } catch {
    // Pattern: http://username:password@host:port
    const credsPattern = /^([a-z]+:\/\/)([^:]+:[^@]+@)(.+)$/i;
    if (credsPattern.test(url)) {
      return url.replace(credsPattern, '$1[USER]:[PASS]@$3');
    }
    return url;
  }
}

/**
 * Custom censor function for proxy credentials
 * Provides debug-friendly redaction with hints
 */
function proxyCredentialCensor(value: any, path: string[]): string {
  const pathString = path.join('.');
  const valueString = value?.toString() || '';

  // Password: show character count only (for debugging)
  if (pathString.includes('password')) {
    return `[REDACTEDx${valueString.length}]`;
  }

  // Username: show first character
  if (pathString.includes('username')) {
    return valueString.length > 0
      ? `${valueString[0]}${'*'.repeat(Math.max(0, valueString.length - 1))}`
      : '[REDACTED]';
  }

  // Proxy server URL: mask embedded credentials
  if (pathString.includes('server')) {
    return maskProxyServerUrl(valueString);
  }

  return '[REDACTED]';
}

// Configure pino logger for structured JSON output with ECS compliance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Redact sensitive proxy credentials from logs
  redact: {
    paths: PROXY_REDACTION_PATHS,
    censor: proxyCredentialCensor,
    remove: false
  },
  formatters: {
    level: (label, number) => {
      // In development, use simple level name; in production, use ECS format
      if (process.env.NODE_ENV === 'development') {
        return { level: label };
      }
      return {
        'log.level': label,
        'log.syslog.severity.code': LOG_LEVEL_SEVERITY[label] || number
      };
    }
  },
  timestamp: () =>
    process.env.NODE_ENV === 'development'
      ? `,"time":"${new Date().toISOString()}"`
      : `,"@timestamp":"${new Date().toISOString()}"`,
  // Only add ECS base fields in production
  base:
    process.env.NODE_ENV === 'development'
      ? null
      : {
          // ECS version marker
          'ecs.version': '8.11.0',

          // Service identification
          'service.name': 'playwright-server',
          'service.type': 'api',

          // Process information
          'process.pid': process.pid,
          'process.name': 'node',

          // Host information
          'host.hostname': os.hostname(),
          'host.os.platform': os.platform(),
          'host.architecture': os.arch()
        },
  // Use pino-pretty in development for human-readable logs
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  })
});

// Sensitive keys that should be redacted from logs
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'sessionid',
  'session_id',
  'access_token',
  'refresh_token',
  'private_key',
  'privatekey',
  'credit_card',
  'creditcard',
  'cvv',
  'ssn',
  'pin',
  'text', // for type/fill commands
  'value' // for setValue commands
];

/**
 * Check if a selector indicates sensitive input
 */
function isSensitiveSelector(selector?: string): boolean {
  if (!selector) return false;
  const selectorLower = selector.toLowerCase();
  return (
    selectorLower.includes('password') ||
    selectorLower.includes('passwd') ||
    selectorLower.includes('pwd') ||
    selectorLower.includes('secret') ||
    selectorLower.includes('pin') ||
    selectorLower.includes('cvv') ||
    selectorLower.includes('ssn') ||
    selectorLower.includes('credit') ||
    selectorLower.includes('card')
  );
}

/**
 * Sanitize command parameters by removing/redacting sensitive data
 * Also considers command type and selector to detect sensitive inputs
 */
export function sanitizeParams(
  params: Record<string, any> | undefined,
  command?: string,
  selector?: string
): Record<string, any> | undefined {
  if (!params) return undefined;

  const sanitized: Record<string, any> = {};

  // Commands that typically contain sensitive input data
  const sensitiveCommands = ['type', 'fill', 'press'];
  const isSensitiveCommand = command && sensitiveCommands.includes(command);
  const hasSensitiveSelector = isSensitiveSelector(selector);

  for (const [key, value] of Object.entries(params)) {
    const keyLower = key.toLowerCase().replace(/[-_]/g, '');

    // Check if key contains sensitive terms
    const isSensitiveKey = SENSITIVE_KEYS.some((sensitiveKey) =>
      keyLower.includes(sensitiveKey.toLowerCase())
    );

    // Redact 'text' field if:
    // 1. The key itself is sensitive (e.g., 'password')
    // 2. It's a type/fill command with sensitive selector (e.g., input[name="password"])
    const shouldRedact =
      isSensitiveKey ||
      (isSensitiveCommand && hasSensitiveSelector && (key === 'text' || key === 'value'));

    if (shouldRedact) {
      sanitized[key] = `[REDACTEDx${value ? value.toString().length : 0}]`;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? sanitizeParams(item as Record<string, any>, command, selector)
            : item
        );
      } else {
        sanitized[key] = sanitizeParams(value as Record<string, any>, command, selector);
      }
    } else if (typeof value === 'string' && value.length > 500) {
      // Truncate very long strings (might contain sensitive data)
      sanitized[key] = value.substring(0, 500) + '... [TRUNCATED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log command execution to stdout in structured JSON format (ECS-compliant)
 * Session-scoped, one line per command execution
 */
export function logCommandExecution(entry: SessionLogEntry): void {
  try {
    // Build log object - use ECS fields only in production
    const isDev = process.env.NODE_ENV === 'development';

    const logObject = isDev
      ? {
          // Simple dev fields
          correlationId: entry.correlationId,
          sessionId: entry.sessionId,
          command: entry.command,
          index: entry.index,
          durationMs: entry.durationMs,
          status: entry.status,
          ...(entry.selector && { selector: entry.selector }),
          ...(entry.params && { params: entry.params }),
          ...(entry.metadata && { metadata: entry.metadata }),
          ...(entry.error && { error: entry.error })
        }
      : {
          // ECS-compliant event fields for production
          'event.kind': 'event',
          'event.category': ['web'],
          'event.type': entry.status === 'error' ? ['error'] : ['info'],
          'event.action': 'playwright-command-execution',
          'event.outcome': entry.status === 'error' ? 'failure' : 'success',
          'event.duration': entry.durationMs ? entry.durationMs * 1000000 : undefined,
          'trace.id': entry.correlationId,
          'playwright.session_id': entry.sessionId,
          'playwright.command': entry.command,
          'playwright.command_index': entry.index,
          'playwright.selector': entry.selector,
          'playwright.params': entry.params,
          'playwright.metadata': entry.metadata,
          ...(entry.error && {
            'error.message': entry.error
          })
        };

    // Log with appropriate level based on status
    if (entry.status === 'error') {
      logger.error(logObject, `Command failed: ${entry.command}`);
    } else {
      logger.info(logObject, `Command executed: ${entry.command}`);
    }
  } catch (err) {
    // Silently fail - logging should not break execution
    logger.error(
      { 'error.message': err instanceof Error ? err.message : String(err) },
      'Logger error'
    );
  }
}

/**
 * Export logger instance for other modules to use
 */
export { logger };
