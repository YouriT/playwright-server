# Research: Proxy Configuration Support

**Feature**: 003-proxy-support  
**Date**: 2025-11-22  
**Status**: Complete

## Overview

This document consolidates research findings for implementing proxy configuration support in playwright-server. Research covered four key areas: Playwright proxy API, proxy URL parsing, credential redaction in logs, and environment variable conventions.

## 1. Playwright Proxy Configuration API

### Decision

Use Playwright's native `BrowserContext.newContext()` proxy configuration option, passing proxy configuration at context creation time (not browser launch time).

### TypeScript Interface

```typescript
{
  proxy?: {
    server: string;        // Required: proxy URL (http://host:port, https://..., socks5://...)
    bypass?: string;       // Optional: comma-separated domains to exclude
    username?: string;     // Optional: authentication username
    password?: string;     // Optional: authentication password
  }
}
```

### Supported Protocols

- **HTTP**: `http://myproxy.com:3128` ✅
- **HTTPS**: `https://myproxy.com:3128` ✅
- **SOCKS5**: `socks5://myproxy.com:3128` ✅
- **SOCKS4**: Not explicitly mentioned in Playwright docs ❌

### Authentication

Proxy authentication is passed via optional `username` and `password` fields:

```typescript
const context = await browser.newContext({
  proxy: {
    server: 'http://myproxy.com:3128',
    username: 'user',
    password: 'secret'
  }
});
```

- Authentication supported for HTTP/HTTPS proxies
- SOCKS5 authentication depends on Chromium implementation
- No separate authentication step required - credentials sent automatically

### Error Handling

1. **Invalid proxy URL format** → Throws error during `newContext()`
2. **Unreachable proxy server** → May succeed at context creation but fail during first network request
3. **Authentication failures** → Manifest as navigation failures (timeout/network errors)

**Key Insight**: Proxy errors may occur at context creation OR during navigation, not always immediately.

### Code Example

```typescript
// Per-context proxy (recommended for our use case)
const browser = await chromium.launch();
const context = await browser.newContext({
  proxy: {
    server: 'socks5://myproxy.com:3128',
    username: 'usr',
    password: 'pwd',
    bypass: 'localhost, 127.0.0.1'
  }
});
```

### Rationale

- Context-level proxy configuration allows different proxies per session
- Direct mapping to Playwright API maintains "thin wrapper" principle
- SOCKS5 support enables Tor, SSH tunnels, and enterprise proxies
- `bypass` parameter handles localhost/internal network exclusions

### Alternatives Considered

1. **Browser-level proxy** (`chromium.launch({ proxy: {...} })`)
   - Rejected: applies to ALL contexts, prevents per-session configuration
2. **Using separate proxy libraries** (e.g., `proxy-agent`)
   - Rejected: unnecessary abstraction, Playwright handles proxy natively
3. **Supporting SOCKS4**
   - Rejected: largely obsolete, SOCKS5 is standard

## 2. Proxy URL Parsing

### Decision

Use Node.js built-in `URL` class (WHATWG URL API) for parsing proxy URLs. No external dependencies required.

### Implementation

```typescript
interface ProxyConfig {
  protocol: string;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
}

function parseProxyUrl(proxyUrlString: string): ProxyConfig {
  // Validate URL
  if (typeof URL.canParse === 'function' && !URL.canParse(proxyUrlString)) {
    throw new Error(`Invalid proxy URL: ${proxyUrlString}`);
  }

  const proxyUrl = new URL(proxyUrlString);

  // Extract protocol without colon
  const protocol = proxyUrl.protocol.replace(':', '');

  // Validate supported protocols
  const supportedProtocols = ['http', 'https', 'socks5'];
  if (!supportedProtocols.includes(protocol)) {
    throw new Error(
      `Unsupported proxy protocol: ${protocol}. Supported: ${supportedProtocols.join(', ')}`
    );
  }

  // Apply default ports if not specified
  const port = proxyUrl.port ? parseInt(proxyUrl.port, 10) : getDefaultPort(protocol);

  return {
    protocol,
    hostname: proxyUrl.hostname,
    port,
    username: proxyUrl.username || undefined,
    password: proxyUrl.password || undefined
  };
}

function getDefaultPort(protocol: string): number {
  const defaults: Record<string, number> = {
    http: 80,
    https: 443,
    socks5: 1080
  };
  return defaults[protocol] || 80;
}
```

### Handling Edge Cases

1. **Missing Port**: Apply protocol-specific defaults (HTTP: 80, HTTPS: 443, SOCKS5: 1080)
2. **Invalid Protocol**: Throw `TypeError` with clear message
3. **Special Characters in Password**: URL class handles percent-encoding automatically
4. **Missing Credentials**: Returns undefined for username/password
5. **IPv6 Hostnames**: URL class handles correctly (e.g., `http://[::1]:8080`)

### Examples

```typescript
// Basic proxy
parseProxyUrl('http://proxy.example.com:8080');
// → { protocol: 'http', hostname: 'proxy.example.com', port: 8080 }

// With credentials
parseProxyUrl('http://user:pass@proxy.example.com:8080');
// → { protocol: 'http', hostname: 'proxy.example.com', port: 8080,
//     username: 'user', password: 'pass' }

// URL-encoded credentials (automatically decoded)
parseProxyUrl('http://user%40email:p%40ss%3Aword@proxy.example.com:8080');
// → { username: "user@email", password: "p@ss:word" }

// Default port
parseProxyUrl('http://proxy.example.com');
// → { protocol: 'http', hostname: 'proxy.example.com', port: 80 }

// SOCKS5
parseProxyUrl('socks5://127.0.0.1:1080');
// → { protocol: 'socks5', hostname: '127.0.0.1', port: 1080 }
```

### Rationale

- Built-in URL class (Node.js 7.0+) - no external dependencies
- Automatic percent-decoding of credentials
- IPv6 support
- Standard WHATWG URL API (consistent with browser)
- Minimal code complexity

### Alternatives Considered

1. **`proxy-agent` npm package** (1.1k stars)
   - Rejected: unnecessary dependency for simple URL parsing
   - May revisit if advanced proxy features needed (PAC files, auto-detection)
2. **Manual regex parsing**
   - Rejected: error-prone, doesn't handle URL encoding, reinvents wheel
3. **Legacy `url.parse()` from Node.js**
   - Rejected: deprecated, doesn't handle percent-encoding as well

## 3. Pino Credential Redaction

### Decision

Use Pino's built-in `redact` configuration with path-based redaction at logger initialization. Combine with custom serializers for complex masking logic.

### Implementation

```typescript
import pino from 'pino';

const PROXY_REDACTION_PATHS = [
  // Direct proxy config
  'proxy.username',
  'proxy.password',
  'proxy.server',

  // Nested configurations
  'launchOptions.proxy.username',
  'launchOptions.proxy.password',
  'launchOptions.proxy.server',

  // Wildcard patterns
  '*.proxy.username',
  '*.proxy.password',
  '*.proxy.server',

  // Session creation params
  'params.proxy.username',
  'params.proxy.password',
  'params.proxy.server'
];

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

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: PROXY_REDACTION_PATHS,
    censor: proxyCredentialCensor,
    remove: false
  },
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime
});
```

### Example Output

```typescript
logger.info(
  {
    proxy: {
      server: 'http://myuser:mypass@proxy.example.com:8080',
      username: 'myuser',
      password: 'supersecret'
    }
  },
  'Configuring browser with proxy'
);

// Output:
// {
//   "level": "info",
//   "time": "2025-11-22T10:30:45.123Z",
//   "proxy": {
//     "server": "http://[USER]:[PASS]@proxy.example.com:8080",
//     "username": "m*****",
//     "password": "[REDACTEDx11]"
//   },
//   "msg": "Configuring browser with proxy"
// }
```

### Performance Considerations

| Method                           | Performance | Overhead    | Use Case                      |
| -------------------------------- | ----------- | ----------- | ----------------------------- |
| `redact` config (explicit paths) | Best        | ~2%         | Static known paths            |
| `redact` config (wildcards)      | Moderate    | ~50%        | Dynamic nested objects        |
| `serializers`                    | Moderate    | Medium      | Complex transformations       |
| `hooks.streamWrite`              | Worst       | Significant | Post-serialization string ops |

**Recommendation**: Use `redact` with explicit paths + wildcards. Good balance of performance and flexibility.

### Rationale

- Declarative configuration prevents credentials entering log pipeline
- Wildcards handle nested/dynamic proxy configurations
- Custom censor function provides useful debugging hints (character count, first letter)
- Aligns with Constitution Principle VI (Structured Logging & Observability)

### Alternatives Considered

1. **Serializers only** (without redact config)
   - Rejected: runs on every log call, less performant
2. **hooks.streamWrite string replacement**
   - Rejected: slowest method, should be last resort
3. **No redaction** (trust external log processors)
   - Rejected: violates security requirements, credentials would be logged

## 4. Environment Variable Conventions

### Decision

Support standard proxy environment variables with lowercase priority: `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` (with lowercase fallbacks for compatibility).

### Environment Variable Names

**Primary:**

- `HTTP_PROXY` / `http_proxy` - Default proxy for all requests
- `HTTPS_PROXY` / `https_proxy` - Proxy for HTTPS requests (optional override)
- `NO_PROXY` / `no_proxy` - Comma-separated bypass list

**Format:**

```bash
HTTP_PROXY=http://proxy.example.com:8080
HTTP_PROXY=http://user:pass@proxy.example.com:8080
HTTP_PROXY=socks5://proxy.example.com:1080
NO_PROXY=localhost,127.0.0.1,::1,.internal.com
```

### Implementation

```typescript
// Read from environment with priority (lowercase first for compatibility)
function getGlobalProxyConfig(): ProxyConfig | null {
  const proxyUrl =
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY;

  if (!proxyUrl) return null;

  const noProxy = process.env.no_proxy || process.env.NO_PROXY || 'localhost,127.0.0.1,::1'; // Default bypass

  try {
    const config = parseProxyUrl(proxyUrl);

    // Log configuration (credentials redacted)
    const url = new URL(proxyUrl);
    logger.info(
      {
        type: 'proxy_config',
        source: 'environment',
        server: `${url.protocol}//${url.host}`,
        bypass: noProxy
      },
      'Global proxy configured'
    );

    return {
      ...config,
      bypass: noProxy
    };
  } catch (error) {
    logger.error(
      {
        type: 'proxy_config_error',
        error: error instanceof Error ? error.message : String(error)
      },
      'Invalid proxy configuration in environment variables'
    );

    throw new Error(
      `Invalid proxy configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

### Compatibility Matrix

| Tool       | `http_proxy` | `HTTP_PROXY`  | Case Priority       |
| ---------- | ------------ | ------------- | ------------------- |
| curl       | ✅           | ❌ (security) | lowercase only      |
| wget       | ✅           | ❌            | lowercase only      |
| Ruby       | ✅           | ⚠️ (warning)  | lowercase first     |
| Python     | ✅           | ⚠️ (CGI risk) | lowercase first     |
| Go         | ✅           | ✅            | **uppercase first** |
| Node.js    | Via flag     | Via flag      | -                   |
| Playwright | ❌ (manual)  | ❌ (manual)   | -                   |

**Note**: Playwright does NOT automatically use proxy environment variables - they must be explicitly parsed and passed to the API.

### Security Considerations

1. **httpoxy vulnerability**: `HTTP_PROXY` can be security risk in CGI environments
   - Solution: Check lowercase first, validate URL format
2. **Credentials in environment**:
   - Document visibility risk (visible in `ps aux`, Docker inspect)
   - Recommend using secrets management for production
3. **NO_PROXY bypass**:
   - Always exclude localhost by default: `localhost,127.0.0.1,::1`
   - Prevents internal requests leaking through external proxy
4. **Logging**:
   - Never log credentials
   - Log only protocol, host, port

### Rationale

- Matches de facto standards (curl, wget, npm, Docker)
- Compatible with Kubernetes, CI/CD environments
- Lowercase-first priority improves security (httpoxy mitigation)
- Simple URL format (no need for separate PROXY_HOST, PROXY_PORT vars)
- Default NO_PROXY prevents common misconfiguration

### Alternatives Considered

1. **Custom env vars** (e.g., `PLAYWRIGHT_SERVER_PROXY`)
   - Rejected: breaks compatibility with standard tooling
   - Users would need to set multiple env vars
2. **Separate variables** (PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS)
   - Rejected: more complex, non-standard
3. **Only uppercase** (HTTP_PROXY, HTTPS_PROXY)
   - Rejected: incompatible with curl/wget, security issues
4. **Automatic Playwright detection**
   - Not possible: Playwright doesn't read proxy env vars automatically
   - Must be explicitly configured via API

## Summary of Decisions

| Area                  | Decision                                           | Key Rationale                                              |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Playwright API        | Use `BrowserContext.newContext({ proxy })`         | Context-level config enables per-session proxies           |
| Protocols             | HTTP, HTTPS, SOCKS5                                | Covers all common use cases, SOCKS5 for advanced scenarios |
| URL Parsing           | Built-in `URL` class                               | No dependencies, handles encoding, standard API            |
| Credential Redaction  | Pino `redact` config + custom censor               | Performant, secure, provides debug hints                   |
| Environment Variables | `http_proxy`, `HTTP_PROXY` with lowercase priority | Standard conventions, maximum compatibility                |
| Default Bypass        | `localhost,127.0.0.1,::1`                          | Security: prevent internal leaks                           |
| Error Handling        | Fail fast at startup for invalid global proxy      | Early detection, clear error messages                      |

## Implementation Notes

1. **Proxy Configuration Flow**:
   - Server startup: Load & validate global proxy from env vars
   - Session creation: Accept optional proxy in request body
   - Priority: Session-specific > Global > None
2. **Validation**:
   - URL format validation using URL class
   - Protocol validation (http/https/socks5)
   - Port range validation (1-65535)
   - Credential completeness (username + password or neither)
3. **Error Messages**:
   - "Invalid proxy URL format: {url}"
   - "Unsupported proxy protocol: {protocol}. Supported: http, https, socks5"
   - "Proxy authentication incomplete: username provided without password"
   - "Failed to connect through proxy: {error}"

4. **Testing Strategy** (manual, per Constitution):
   - Test with real proxy service (e.g., Bright Data free tier)
   - Test all protocols: HTTP, HTTPS, SOCKS5
   - Test with/without authentication
   - Test global vs per-session configuration
   - Test invalid URLs, unsupported protocols
   - Verify credential redaction in logs

## Next Phase

Proceed to Phase 1: Generate data-model.md, contracts/openapi.yaml, and quickstart.md based on these research findings.
