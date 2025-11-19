# Playwright HTTP Wrapper

A lightweight HTTP server that wraps Playwright (via Patchright) functionality, enabling browser automation via HTTP requests without requiring local Playwright installation.

## Features

- **Session Management**: Create isolated browser sessions with configurable TTL
- **Command Execution**: Execute Playwright commands via HTTP POST requests
- **Video Recording**: Optional session recording with automatic cleanup
- **Concurrent Sessions**: Support for multiple simultaneous browser sessions
- **Automatic Cleanup**: TTL-based session expiration and resource management

## Quick Start

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file based on `.env.example` (environment variables are loaded using dotenv):

```bash
cp .env.example .env
```

Configuration options:

- `PORT`: Server port (default: 3000)
- `MAX_CONCURRENT_SESSIONS`: Maximum number of concurrent sessions (default: 10)
- `RECORDINGS_DIR`: Directory for session recordings (default: ./recordings)

**Note**: The server will work with default values even if `.env` file is not present.

### Build and Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or run in development mode
npm run dev
```

### Test the Implementation

```bash
# Start the server
npm run dev

# In another terminal, test with curl
curl http://localhost:3000/health
```

The server provides a RESTful API for browser automation. See the API Usage section below for examples.

## API Usage

### 1. Create a Session

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 1800000,
    "recording": false
  }'
```

Response:
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sessionUrl": "http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/command",
  "stopUrl": "http://localhost:3000/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiresAt": "2025-11-19T11:00:00.000Z",
  "createdAt": "2025-11-19T10:30:00.000Z"
}
```

### 2. Execute Commands

Navigate to a website:
```bash
curl -X POST http://localhost:3000/sessions/${session_id}/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "navigate",
    "options": {
      "url": "https://example.com",
      "waitUntil": "networkidle"
    }
  }'
```

Click an element:
```bash
curl -X POST http://localhost:3000/sessions/${session_id}/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "click",
    "selector": "#submit-button"
  }'
```

Extract text:
```bash
curl -X POST http://localhost:3000/sessions/${session_id}/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "textContent",
    "selector": "h1"
  }'
```

### 3. Terminate Session

```bash
curl -X DELETE http://localhost:3000/sessions/{sessionId}
```

## Available Commands

### Navigation
- `navigate` / `goto` - Navigate to a URL with wait options

### Element Interaction
- `click` - Click an element by selector
- `type` / `fill` - Fill input fields
- `press` - Press keyboard keys

### Data Extraction
- `textContent` - Get element text
- `getAttribute` - Get element attributes
- `screenshot` - Capture page screenshots (base64)
- `evaluate` - Execute JavaScript in page context

### Page Manipulation
- `waitForSelector` - Wait for elements to appear

### Cookies & Headers
- `cookies` - Get all cookies from browser context
- `setCookies` - Set cookies in browser context
- `setExtraHTTPHeaders` - Set custom HTTP headers

**Example:**
```json
{
  "command": "click",
  "options": {
    "selector": "button#submit"
  }
}
```

## Session Recording

Enable video recording by setting `recording: true` when creating a session:

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ttl": 1800000,
    "recording": true
  }'
```

Access recordings via the `playbackUrl` returned in the response. Recordings are automatically deleted 1 hour after session termination.

## Concurrent Sessions

The server supports multiple concurrent sessions (default: 10). Each session has:

- Isolated browser context (cookies, storage, authentication)
- Independent TTL management
- Separate video recording (if enabled)

Example: Run 5 sessions in parallel:

```bash
# Create 5 sessions simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3000/sessions \
    -H "Content-Type: application/json" \
    -d '{"ttl": 1800000}' &
done
wait
```

List active sessions:
```bash
curl http://localhost:3000/sessions
```

## Architecture

Built with:
- **TypeScript** (strict mode)
- **Express** (web framework)
- **Patchright** (stealth Playwright fork)
- **Node.js** 20.x LTS

Project structure:
```
src/
├── types/          # TypeScript type definitions
├── services/       # Core business logic
├── routes/         # HTTP endpoint handlers
├── middleware/     # Express middleware
├── utils/          # Utility functions
└── server.ts       # Main entry point
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean
```

## Error Handling

All errors include descriptive messages:

- `404 SessionNotFoundError`: Session not found or expired
- `400 CommandNotFoundError`: Invalid command name
- `400 ValidationError`: Invalid request parameters
- `408 TimeoutError`: Command execution timeout
- `404 ElementNotFoundError`: Selector not found
- `503 MaxSessionsReached`: Concurrent session limit reached

## License

ISC

## Contributing

See [AGENTS.md](AGENTS.md) for development guidelines.
