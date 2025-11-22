# Data Model: Proxy Configuration Support

**Feature**: 003-proxy-support  
**Date**: 2025-11-22  
**Based on**: research.md

## Overview

This document defines the data entities and their relationships for proxy configuration support. The feature extends existing session management with optional proxy configuration at both global (server) and session levels.

## Entity Definitions

### 1. ProxyConfig

Represents proxy server configuration with authentication and protocol settings.

**Fields**:

- `protocol`: ProxyProtocol (enum) - Proxy protocol type (HTTP, HTTPS, SOCKS5)
- `hostname`: string - Proxy server hostname or IP address
- `port`: number - Proxy server port (1-65535)
- `username`: string | undefined - Optional authentication username
- `password`: string | undefined - Optional authentication password
- `bypass`: string | undefined - Optional comma-separated list of hosts to exclude from proxy

**Validation Rules**:

- `protocol` MUST be one of: 'http', 'https', 'socks5'
- `hostname` MUST be non-empty string
- `port` MUST be integer between 1 and 65535 (inclusive)
- `username` and `password` MUST both be present or both be absent (no partial auth)
- `bypass` MUST be comma-separated list of domains (if provided)

**Invariants**:

- ProxyConfig is immutable once session is created
- Credentials MUST be redacted in all log output
- Server field for Playwright MUST be reconstructed as `${protocol}://${hostname}:${port}`

**TypeScript Definition**:

```typescript
interface ProxyConfig {
  protocol: ProxyProtocol;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  bypass?: string;
}
```

**State Transitions**:

- Created: when parsed from environment variables or API request
- Validated: after URL parsing and validation
- Applied: when passed to Playwright BrowserContext
- Immutable: cannot be modified after session creation

---

### 2. ProxyProtocol

Enumeration of supported proxy protocols.

**Values**:

- `http` - HTTP proxy (default port: 80)
- `https` - HTTPS proxy (default port: 443)
- `socks5` - SOCKS5 proxy (default port: 1080)

**TypeScript Definition**:

```typescript
enum ProxyProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS5 = 'socks5'
}

// Or as union type:
type ProxyProtocol = 'http' | 'https' | 'socks5';
```

---

### 3. SessionData (Extended)

Existing entity extended to include optional proxy configuration.

**New Fields**:

- `proxyConfig`: ProxyConfig | null - Session-specific proxy configuration (overrides global)

**Relationships**:

- One-to-one with ProxyConfig (optional)
- ProxyConfig is owned by SessionData
- ProxyConfig lifetime matches session lifetime

**Modified TypeScript Definition**:

```typescript
interface SessionData {
  id: string;
  ttl: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  browserContext: BrowserContext;
  timeoutHandle: NodeJS.Timeout;
  recordingMetadata: RecordingMetadata | null;
  proxyConfig: ProxyConfig | null; // NEW FIELD
}
```

**Validation Rules**:

- If `proxyConfig` is provided, it MUST be valid ProxyConfig
- `proxyConfig` takes precedence over global proxy configuration
- `proxyConfig` cannot be modified after session creation

---

### 4. GlobalServerConfig (Conceptual)

Represents server-wide default proxy configuration loaded from environment variables. This is not a TypeScript entity but a conceptual model.

**Source**: Environment variables at server startup

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

**Lifecycle**:

- Loaded: once at server startup
- Validated: before server starts accepting requests
- Cached: in-memory for session creation
- Immutable: cannot be changed without server restart

**Usage**:

- Applied as default when session is created without explicit proxy
- Overridden by session-specific proxy configuration
- Null if no proxy environment variables set

**Conceptual Structure**:

```typescript
interface GlobalServerConfig {
  defaultProxy: ProxyConfig | null;
  loadedAt: Date;
  source: 'environment' | 'none';
}
```

---

### 5. CreateSessionOptions (Extended)

API request options for session creation, extended to accept optional proxy.

**New Fields**:

- `proxy`: ProxyConfig | ProxyUrl | undefined - Optional session-specific proxy

**TypeScript Definition**:

```typescript
interface CreateSessionOptions {
  ttl: number;
  recording?: boolean;
  videoSize?: {
    width: number;
    height: number;
  };
  proxy?: {
    // NEW FIELD
    server: string; // Full URL: protocol://[user:pass@]host:port
    username?: string; // Alternative: separate username
    password?: string; // Alternative: separate password
    bypass?: string; // Optional: comma-separated domains
  };
}
```

**Validation Rules**:

- If `proxy.server` is provided, it MUST be valid URL
- If `proxy.username` is provided, `proxy.password` MUST also be provided
- If `proxy.server` contains embedded credentials, they take precedence over separate username/password fields

**Transformation**:

- API request `proxy` → parsed to `ProxyConfig`
- `ProxyConfig` → passed to Playwright as `{ server, username, password, bypass }`

---

## Entity Relationships

```
GlobalServerConfig (1) ──── (0..1) ProxyConfig
         │
         │ (default for)
         ▼
    SessionData (1) ──── (0..1) ProxyConfig
         │
         │ (uses)
         ▼
    BrowserContext (Playwright)
```

**Relationships**:

1. GlobalServerConfig has zero or one default ProxyConfig
2. SessionData has zero or one session-specific ProxyConfig
3. SessionData uses either session-specific ProxyConfig OR global default
4. BrowserContext is configured with the effective ProxyConfig at creation time

**Priority**:

```
Session-specific ProxyConfig > Global default ProxyConfig > No proxy (direct)
```

---

## Validation Rules Summary

### ProxyConfig Validation

```typescript
function validateProxyConfig(config: ProxyConfig): ValidationResult {
  const errors: string[] = [];

  // Protocol validation
  if (!['http', 'https', 'socks5'].includes(config.protocol)) {
    errors.push(`Unsupported protocol: ${config.protocol}`);
  }

  // Hostname validation
  if (!config.hostname || config.hostname.trim() === '') {
    errors.push('Hostname is required');
  }

  // Port validation
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`Port must be between 1 and 65535, got: ${config.port}`);
  }

  // Authentication validation
  const hasUsername = config.username !== undefined && config.username !== '';
  const hasPassword = config.password !== undefined && config.password !== '';
  if (hasUsername !== hasPassword) {
    errors.push('Username and password must both be provided or both be omitted');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Data Flow

### 1. Server Startup (Global Proxy)

```
Environment Variables
  ↓
getGlobalProxyConfig()
  ↓
parseProxyUrl(HTTP_PROXY)
  ↓
validateProxyConfig()
  ↓
GlobalServerConfig.defaultProxy
```

### 2. Session Creation (Session-Specific Proxy)

```
HTTP POST /sessions
  ↓
CreateSessionOptions.proxy
  ↓
parseProxyUrl(proxy.server) OR use separate fields
  ↓
validateProxyConfig()
  ↓
SessionData.proxyConfig
  ↓
browser.newContext({ proxy: { server, username, password, bypass } })
  ↓
BrowserContext (Playwright)
```

### 3. Effective Proxy Resolution

```typescript
function getEffectiveProxy(
  sessionProxy: ProxyConfig | null,
  globalProxy: ProxyConfig | null
): ProxyConfig | null {
  return sessionProxy || globalProxy || null;
}
```

---

## Error Handling

### Validation Errors

**ProxyValidationError** (new error type):

- Thrown when proxy URL format is invalid
- Thrown when proxy protocol is unsupported
- Thrown when authentication is incomplete
- HTTP 400 response when session creation fails

**Example**:

```typescript
class ProxyValidationError extends Error {
  constructor(
    message: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'ProxyValidationError';
  }
}
```

### Runtime Errors

**ProxyConnectionError** (conceptual):

- Occurs during browser context creation or navigation
- May manifest as Playwright errors
- Logged with redacted credentials

---

## Security Considerations

### Credential Storage

- Credentials stored in-memory only (SessionData, GlobalServerConfig)
- Never persisted to disk or database
- Cleared when session ends

### Credential Logging

- All log output MUST redact username and password
- Pino redaction paths configured for:
  - `proxy.username`, `proxy.password`
  - `proxyConfig.username`, `proxyConfig.password`
  - `*.proxy.username`, `*.proxy.password`

### Credential Transmission

- Credentials passed to Playwright via in-memory object
- Playwright handles proxy authentication via HTTP headers
- No additional encryption layer needed (TLS handled by proxy protocol)

---

## Examples

### Example 1: Global Proxy (Environment Variable)

```bash
export HTTP_PROXY=http://user:pass@proxy.brightdata.com:22225
export NO_PROXY=localhost,127.0.0.1
```

Resulting GlobalServerConfig:

```typescript
{
  defaultProxy: {
    protocol: 'http',
    hostname: 'proxy.brightdata.com',
    port: 22225,
    username: 'user',
    password: 'pass',
    bypass: 'localhost,127.0.0.1'
  },
  loadedAt: new Date('2025-11-22T10:00:00Z'),
  source: 'environment'
}
```

### Example 2: Session-Specific Proxy (API Request)

```json
POST /sessions
{
  "ttl": 300000,
  "recording": false,
  "proxy": {
    "server": "socks5://proxy-us.example.com:1080",
    "username": "customer-abc",
    "password": "secret123"
  }
}
```

Resulting SessionData.proxyConfig:

```typescript
{
  protocol: 'socks5',
  hostname: 'proxy-us.example.com',
  port: 1080,
  username: 'customer-abc',
  password: 'secret123',
  bypass: undefined
}
```

### Example 3: No Proxy (Direct Connection)

```json
POST /sessions
{
  "ttl": 300000,
  "recording": false
}
```

With no global proxy set:

```typescript
SessionData.proxyConfig = null;
// Browser uses direct connection
```

---

## Migration Notes

**Backward Compatibility**:

- Existing sessions without proxy continue to work unchanged
- `SessionData.proxyConfig` defaults to null
- No breaking changes to existing API

**Database Impact**:

- Not applicable (in-memory storage only)

**API Changes**:

- POST /sessions accepts optional `proxy` field
- No new required fields
- Response unchanged (proxy config not returned for security)

---

## Summary

This data model extends playwright-server with proxy support while maintaining simplicity:

- **1 new entity**: ProxyConfig (plus ProxyProtocol enum)
- **1 extended entity**: SessionData (add proxyConfig field)
- **1 conceptual entity**: GlobalServerConfig (environment-based)
- **Clear validation rules**: Protocol, port, authentication completeness
- **Security by design**: Credential redaction, immutable config
- **Backward compatible**: Optional fields, defaults to null
