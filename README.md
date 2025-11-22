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

## License

ISC

## Contributing

See [AGENTS.md](AGENTS.md) for development guidelines.
