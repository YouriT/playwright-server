# Data Model: Playwright HTTP Wrapper

**Feature Branch**: `001-playwright-http-wrapper`  
**Date**: 2025-11-19  
**Status**: Complete

This document defines all data entities, their relationships, validation rules, and state transitions for the Playwright HTTP wrapper.

---

## Entity 1: Session

Represents an active browser automation session with a unique identifier and associated browser context.

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `id` | string (UUID v4) | Yes | Unique session identifier | Auto-generated, immutable |
| `ttl` | number | Yes | Time-to-live in milliseconds | Min: 60000 (1 minute), Max: 14400000 (4 hours), Default: 1800000 (30 minutes) |
| `createdAt` | Date | Yes | Timestamp when session was created | Auto-generated, immutable |
| `lastActivityAt` | Date | Yes | Timestamp of last command execution | Auto-updated on each command |
| `expiresAt` | Date | Yes | Computed expiration time | Computed: `lastActivityAt + ttl`, updated on each command |
| `browserContext` | BrowserContext | Yes | Patchright browser context instance | Reference to Playwright object, not serializable |
| `timeoutHandle` | NodeJS.Timeout | Yes | Timer handle for automatic cleanup | Internal use, manages TTL expiration |
| `recordingMetadata` | RecordingMetadata \| null | No | Recording configuration and metadata | Null if recording not enabled |

### Relationships
- **One-to-One with Recording**: Each session may have zero or one recording
- **One-to-Many with Commands**: Each session processes zero or many commands during its lifetime

### Validation Rules
- `id` must be unique across all active sessions
- `ttl` must be between 60000ms (1 minute) and 14400000ms (4 hours)
- `expiresAt` must always be `lastActivityAt + ttl`
- `browserContext` must be a valid, non-closed Playwright BrowserContext
- Cannot modify `id`, `createdAt`, or `browserContext` after creation

### State Transitions

```
[Creation Request] 
    ↓
CREATING (browser context being initialized)
    ↓
ACTIVE (ready to receive commands)
    ↓ (on command execution)
ACTIVE (TTL reset, lastActivityAt updated)
    ↓ (TTL expires OR stop URL called OR crash)
TERMINATING (cleanup in progress)
    ↓
TERMINATED (removed from session store)
```

**State Rules**:
- **CREATING → ACTIVE**: When browser context successfully initialized and page opened
- **ACTIVE → ACTIVE**: On each successful command execution (TTL reset)
- **ACTIVE → TERMINATING**: When TTL expires, stop URL called, or browser crashes
- **TERMINATING → TERMINATED**: When `context.close()` completes and session removed from Map

---

## Entity 2: Command

Represents a single Playwright/Patchright operation to be executed on a session.

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `command` | string | Yes | Playwright method name | Must be registered in CommandRegistry |
| `selector` | string | No | CSS/XPath selector for element operations | Required for element-targeting commands (click, type, etc.) |
| `options` | object | No | Additional parameters for the command | Structure depends on specific command |
| `result` | any | No | Return value from command execution | Populated after successful execution |
| `error` | CommandError \| null | No | Error details if execution failed | Null if successful |

### Command Types

**Navigation Commands**:
- `navigate` / `goto`: Navigate to URL
  - `options.url` (string, required): Target URL
  - `options.waitUntil` (string, optional): Load event to wait for ('load', 'domcontentloaded', 'networkidle')

**Element Interaction Commands**:
- `click`: Click element
  - `selector` (string, required): Element selector
  - `options.button` (string, optional): Mouse button ('left', 'right', 'middle')
  - `options.clickCount` (number, optional): Number of clicks
- `type` / `fill`: Type text into element
  - `selector` (string, required): Input element selector
  - `options.text` (string, required): Text to type
- `press`: Press keyboard key
  - `options.key` (string, required): Key name (e.g., 'Enter', 'Escape')

**Data Extraction Commands**:
- `textContent`: Extract text from element
  - `selector` (string, required): Element selector
  - Returns: string | null
- `getAttribute`: Get element attribute value
  - `selector` (string, required): Element selector
  - `options.attribute` (string, required): Attribute name
  - Returns: string | null
- `screenshot`: Capture screenshot
  - `options.fullPage` (boolean, optional): Capture full scrollable page
  - `options.path` (string, optional): File path to save
  - Returns: Buffer (image data)

**Page Manipulation Commands**:
- `waitForSelector`: Wait for element to appear
  - `selector` (string, required): Element selector
  - `options.timeout` (number, optional): Max wait time in milliseconds
- `evaluate`: Execute JavaScript in page context
  - `options.script` (string, required): JavaScript code to execute
  - Returns: any (serializable result)

### Validation Rules
- `command` must exist in CommandRegistry
- `selector` must be valid CSS or XPath selector when required
- `options` must match expected schema for the specific command
- Cannot execute commands on non-existent or expired sessions
- Cannot execute commands while previous command is still executing

### Relationships
- **Many-to-One with Session**: Each command belongs to exactly one session

### Error Handling

Commands may fail with these error types:

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `SessionNotFoundError` | 404 | Session ID does not exist or has expired |
| `CommandNotFoundError` | 400 | Command name not registered in CommandRegistry |
| `ValidationError` | 400 | Invalid parameters or missing required fields |
| `TimeoutError` | 408 | Command execution exceeded timeout (Playwright default: 30s) |
| `ElementNotFoundError` | 404 | Selector did not match any elements |
| `ExecutionError` | 500 | Command execution failed (browser crash, JavaScript error, etc.) |

---

## Entity 3: RecordingMetadata

Represents video recording configuration and metadata for a session. Embedded within Session entity.

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `enabled` | boolean | Yes | Whether recording is active | Immutable after session creation |
| `playbackUrl` | string | Yes | URL to access the recording | Format: `/recordings/<sessionId>/video.webm` |
| `filePath` | string | Yes | Filesystem path to recording directory | Format: `./recordings/<sessionId>/` |
| `startedAt` | Date | Yes | When recording started | Set when session created |
| `size` | { width: number, height: number } | No | Video dimensions | Default: { width: 1280, height: 720 } |

### Validation Rules
- `enabled` cannot be changed after session creation
- `playbackUrl` must be unique (derived from unique session ID)
- `filePath` must be writable directory
- `size.width` and `size.height` must be positive integers if specified

### Relationships
- **One-to-One with Session**: Each recording belongs to exactly one session
- Recording files exist on filesystem independent of in-memory session state

### State Transitions

```
[Session created with recording:true]
    ↓
RECORDING (video being captured)
    ↓ (session terminated)
FINALIZING (video file being written)
    ↓
AVAILABLE (playback URL accessible)
    ↓ (1 hour after session end)
SCHEDULED_DELETION (marked for cleanup)
    ↓ (cleanup worker runs)
DELETED (file removed from filesystem)
```

**State Rules**:
- **RECORDING**: Active throughout session lifetime
- **FINALIZING**: Brief period when `context.close()` writes final video file
- **AVAILABLE**: Playback URL returns 200 OK with video/webm content
- **SCHEDULED_DELETION**: After 1 hour retention period
- **DELETED**: Playback URL returns 404 Not Found

---

## Entity 4: CommandError

Error information returned when command execution fails.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Error category (see Error Handling section in Command entity) |
| `message` | string | Yes | Human-readable error description |
| `details` | object | No | Additional error context (stack trace, Playwright error details, etc.) |

### Validation Rules
- `type` must be one of the defined error types
- `message` must be non-empty string
- `details` should not contain sensitive information (passwords, tokens, etc.)

---

## Relationships Diagram

```
Session (1) ──┬── (0..1) RecordingMetadata
              │
              └── (0..*) Command ── (0..1) CommandError
```

---

## Storage Implementation

### In-Memory Session Store
```typescript
// sessions.ts
const sessions = new Map<string, SessionData>();

interface SessionData {
  id: string;
  ttl: number;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  browserContext: BrowserContext;
  timeoutHandle: NodeJS.Timeout;
  recordingMetadata: RecordingMetadata | null;
}
```

### Filesystem Recording Storage
```
recordings/
├── <session-id-1>/
│   └── video.webm
├── <session-id-2>/
│   └── video.webm
└── ...
```

**Directory structure**: One directory per session ID containing single `video.webm` file

**Cleanup strategy**: Background worker runs every 15 minutes, deletes directories where session ended more than 1 hour ago

---

## Indexes and Lookups

### Primary Indexes
- **Session by ID**: `sessions.get(sessionId)` - O(1) lookup
- **Recording by session ID**: Derived from session ID in playback URL path

### No Secondary Indexes Needed
- Small scale (max 10 concurrent sessions) doesn't require optimization
- No queries beyond direct session ID lookup
- No search or filtering requirements

---

## Validation Summary

| Entity | Creation Validation | Update Validation | Deletion Validation |
|--------|---------------------|-------------------|---------------------|
| Session | TTL range, unique ID | lastActivityAt must advance, expiresAt must update | Must close browser context before removal |
| Command | Valid command name, required fields present | N/A (commands are immutable after execution) | N/A (commands not stored) |
| RecordingMetadata | Valid file path, enabled flag | Immutable after creation | Must schedule file deletion 1 hour after session end |
| CommandError | Valid error type | N/A (errors are immutable) | N/A (errors not stored) |

---

## Performance Considerations

- **Session lookups**: O(1) via Map, no performance concerns
- **TTL expiration**: Per-session timers, O(1) cleanup trigger
- **Recording storage**: Local filesystem, ~300-600 MB per 1-hour session
- **Concurrent sessions**: Max 10 sessions = max ~5 GB storage (with 1-hour retention)
- **Memory footprint**: ~100-150 MB per active session (browser context + recording buffer)
- **Cleanup overhead**: Background worker runs every 15 minutes, O(n) scan where n = recorded sessions (max 10)

All performance characteristics meet the requirements for a hobby project with <200ms p95 latency for API operations (excluding browser command execution time).
