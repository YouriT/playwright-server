# Playwright HTTP Wrapper

A lightweight HTTP server that wraps Playwright (via Patchright) functionality, enabling browser automation via HTTP requests without requiring local Playwright installation.

## Features

- **Session Management**: Create isolated browser sessions with configurable TTL
- **Command Execution**: Execute Playwright commands via HTTP POST requests
- **Sequential Command Arrays**: Execute multiple commands in sequence with halt-on-failure logic
- **Millisecond-Precision Timing**: Accurate command execution timing for performance analysis
- **Structured JSON Logging**: Session-scoped logs with correlation IDs and sensitive data redaction
- **Video Recording**: Optional session recording with automatic cleanup
- **Concurrent Sessions**: Support for multiple simultaneous browser sessions
- **Automatic Cleanup**: TTL-based session expiration and resource management
- **Proxy Support**: Route browser traffic through HTTP, HTTPS, or SOCKS5 proxies with optional authentication

## Quick Start

```bash
# Install dependencies
npm install

# Build and start
npm run build && npm start

# Test health endpoint
curl http://localhost:3000/health
```

### Configuration (Optional)

Create `.env` file for custom settings:

- `PORT` - Server port (default: 3000)
- `MAX_CONCURRENT_SESSIONS` - Max concurrent sessions (default: 10)
- `RECORDINGS_DIR` - Recording directory (default: ./recordings)
- `LOG_LEVEL` - info, debug, error (default: info)
- `HTTP_PROXY` - Global HTTP/HTTPS proxy (optional)
- `HTTPS_PROXY` - Global HTTPS proxy override (optional)
- `NO_PROXY` - Comma-separated list of hosts to bypass proxy (optional)

**Note:** This server uses Patchright with bundled Chromium browser for enhanced stealth capabilities.

## API Usage

### Create Session

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"ttl": 1800000, "recording": false}'
```

### Execute Commands

**Single command:**

```bash
curl -X POST http://localhost:3000/sessions/${session_id}/command \
  -H "Content-Type: application/json" \
  -d '{"command": "navigate", "options": {"url": "https://example.com"}}'
```

**Command array** (reduces HTTP overhead, halt-on-failure):

```bash
curl -X POST http://localhost:3000/sessions/${session_id}/command \
  -H "Content-Type: application/json" \
  -d '[
    {"command": "navigate", "options": {"url": "https://example.com/login"}},
    {"command": "type", "selector": "input[name=\"username\"]", "options": {"text": "user@example.com"}},
    {"command": "type", "selector": "input[name=\"password\"]", "options": {"text": "mypassword"}},
    {"command": "click", "selector": "button[type=\"submit\"]"}
  ]'
```

Returns HTTP 207 with per-command timing and status.

### Terminate Session

```bash
curl -X DELETE http://localhost:3000/sessions/{sessionId}
```

## Available Commands

**Navigation**: `navigate`, `goto`  
**Interaction**: `click`, `type`, `fill`, `press`  
**Extraction**: `textContent`, `getAttribute`, `screenshot`, `evaluate`  
**Timing**: `waitForSelector`  
**State**: `cookies`, `setCookies`, `setExtraHTTPHeaders`

## Session Recording

Set `"recording": true` when creating a session. Access via `playbackUrl` in response. Videos auto-delete 1 hour after session ends.

## Concurrent Sessions

Supports multiple sessions (default: 10) with isolated contexts. List active sessions:

```bash
curl http://localhost:3000/sessions
```

## Proxy Configuration

Route browser traffic through HTTP, HTTPS, or SOCKS5 proxies.

### Global Proxy (Environment Variables)

Set via environment variables to apply to all sessions by default:

```bash
# HTTP/HTTPS proxy
export HTTP_PROXY="http://proxy.example.com:8080"

# With authentication
export HTTP_PROXY="http://username:password@proxy.example.com:8080"

# SOCKS5 proxy
export HTTP_PROXY="socks5://proxy.example.com:1080"

# Bypass proxy for specific hosts
export NO_PROXY="localhost,127.0.0.1,.example.com"
```

### Per-Session Proxy (API)

Override global proxy for specific sessions:

```bash
# HTTP proxy with authentication
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 1800000,
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    }
  }'

# SOCKS5 proxy without authentication
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 1800000,
    "proxy": {
      "server": "socks5://proxy.example.com:1080"
    }
  }'
```

**Supported protocols:** `http://`, `https://`, `socks5://`

**Priority:** Per-session proxy > Global proxy > Direct connection

**Note:** Proxy credentials are automatically redacted from logs for security.

## License

ISC

## Contributing

See [AGENTS.md](AGENTS.md) for development guidelines.
