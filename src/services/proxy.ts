import { ProxyConfig, ProxyProtocol, ProxyRequestConfig } from '../types/proxy';
import { ProxyValidationError } from '../types/errors';
import { logger } from '../utils/logger';

const SUPPORTED_PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks5'];

const DEFAULT_PORTS: Record<ProxyProtocol, number> = {
  http: 80,
  https: 443,
  socks5: 1080
};

/**
 * Get default port for a given protocol
 */
function getDefaultPort(protocol: string): number {
  return DEFAULT_PORTS[protocol as ProxyProtocol] || 80;
}

/**
 * Parse proxy URL into ProxyConfig
 * Supports formats:
 * - protocol://host:port
 * - protocol://username:password@host:port
 */
export function parseProxyUrl(proxyUrlString: string): ProxyConfig {
  // Validate URL can be parsed
  let proxyUrl: URL;
  try {
    proxyUrl = new URL(proxyUrlString);
  } catch (error) {
    throw new ProxyValidationError(`Invalid proxy URL format: ${proxyUrlString}`, [
      `URL parsing failed: ${error instanceof Error ? error.message : String(error)}`
    ]);
  }

  // Extract protocol without colon
  const protocol = proxyUrl.protocol.replace(':', '');

  // Validate supported protocols
  if (!SUPPORTED_PROTOCOLS.includes(protocol as ProxyProtocol)) {
    throw new ProxyValidationError(`Unsupported proxy protocol: ${protocol}`, [
      `Supported protocols: ${SUPPORTED_PROTOCOLS.join(', ')}`
    ]);
  }

  // Extract port or use default
  const port = proxyUrl.port ? parseInt(proxyUrl.port, 10) : getDefaultPort(protocol);

  // Validate hostname exists
  if (!proxyUrl.hostname) {
    throw new ProxyValidationError('Proxy hostname is required', [
      'URL must include a valid hostname'
    ]);
  }

  return {
    protocol: protocol as ProxyProtocol,
    hostname: proxyUrl.hostname,
    port,
    username: proxyUrl.username || undefined,
    password: proxyUrl.password || undefined,
    bypass: undefined
  };
}

/**
 * Parse proxy configuration from API request
 * Supports both URL format and separate fields
 */
export function parseProxyRequest(request: ProxyRequestConfig): ProxyConfig {
  // Parse the server URL
  const config = parseProxyUrl(request.server);

  // Override with separate username/password if provided
  if (request.username !== undefined || request.password !== undefined) {
    config.username = request.username;
    config.password = request.password;
  }

  // Add bypass if provided
  if (request.bypass !== undefined) {
    config.bypass = request.bypass;
  }

  return config;
}

/**
 * Validate proxy configuration
 * Returns validation errors or empty array if valid
 */
export function validateProxyConfig(config: ProxyConfig): string[] {
  const errors: string[] = [];

  // Protocol validation
  if (!SUPPORTED_PROTOCOLS.includes(config.protocol)) {
    errors.push(
      `Unsupported protocol: ${config.protocol}. Supported protocols: ${SUPPORTED_PROTOCOLS.join(', ')}`
    );
  }

  // Hostname validation
  if (!config.hostname || config.hostname.trim() === '') {
    errors.push('Hostname is required and cannot be empty');
  }

  // Port validation
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`Port must be between 1 and 65535, got: ${config.port}`);
  }

  // Authentication validation - both or neither
  const hasUsername = config.username !== undefined && config.username !== '';
  const hasPassword = config.password !== undefined && config.password !== '';

  if (hasUsername !== hasPassword) {
    errors.push(
      'Proxy authentication incomplete: username and password must both be provided or both be omitted'
    );
  }

  return errors;
}

/**
 * Validate proxy configuration and throw on errors
 */
export function validateProxyConfigOrThrow(config: ProxyConfig): void {
  const errors = validateProxyConfig(config);
  if (errors.length > 0) {
    throw new ProxyValidationError('Invalid proxy configuration', errors);
  }
}

/**
 * Convert ProxyConfig to Playwright proxy format
 */
export function toPlaywrightProxy(config: ProxyConfig): {
  server: string;
  username?: string;
  password?: string;
  bypass?: string;
} {
  return {
    server: `${config.protocol}://${config.hostname}:${config.port}`,
    username: config.username,
    password: config.password,
    bypass: config.bypass
  };
}

/**
 * Get global proxy configuration from environment variables
 * Reads: HTTP_PROXY, HTTPS_PROXY, NO_PROXY (with lowercase fallbacks)
 */
export function getGlobalProxyConfig(): ProxyConfig | null {
  // Try lowercase first for compatibility
  const proxyUrl =
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY;

  if (!proxyUrl) {
    return null;
  }

  try {
    // Parse proxy URL
    const config = parseProxyUrl(proxyUrl);

    // Add NO_PROXY bypass rules
    const noProxy = process.env.no_proxy || process.env.NO_PROXY || 'localhost,127.0.0.1,::1';

    config.bypass = noProxy;

    // Validate configuration
    validateProxyConfigOrThrow(config);

    // Log successful configuration (credentials will be redacted by logger)
    logger.info(
      {
        type: 'proxy_config',
        source: 'environment',
        proxy: {
          protocol: config.protocol,
          hostname: config.hostname,
          port: config.port,
          bypass: config.bypass
        }
      },
      'Global proxy configured from environment variables'
    );

    return config;
  } catch (error) {
    // Log error without exposing credentials
    logger.error(
      {
        type: 'proxy_config_error',
        source: 'environment',
        error: error instanceof Error ? error.message : String(error)
      },
      'Failed to load global proxy configuration from environment variables'
    );

    throw new ProxyValidationError(
      'Invalid global proxy configuration in environment variables',
      error instanceof ProxyValidationError ? error.details : [String(error)]
    );
  }
}
