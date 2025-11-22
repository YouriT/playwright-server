# Research: Sequential Command Execution with Timing and Logging

**Feature**: 002-sequential-commands  
**Date**: 2025-11-22  
**Status**: Complete

## Research Questions

### 1. How to handle single command vs array input for backward compatibility?

**Decision**: Use TypeScript union types and runtime type checking

**Rationale**:

- Express/Node.js naturally supports flexible JSON payloads
- TypeScript union types (`Command | Command[]`) provide type safety
- Runtime check with `Array.isArray()` is performant and idiomatic
- Maintains existing API contract while extending capabilities

**Implementation Approach**:

```typescript
// Type definition
type CommandInput = CommandRequest | CommandRequest[];

// Runtime validation
if (Array.isArray(input)) {
  // Handle array
} else {
  // Handle single command (convert to array internally for uniform processing)
}
```

**Alternatives Considered**:

- **Separate endpoint** (e.g., `/sessions/:id/commands`): Rejected - violates Simplicity First, creates API fragmentation
- **Query parameter flag** (e.g., `?batch=true`): Rejected - not RESTful, complicates request structure
- **Always require array**: Rejected - breaks backward compatibility (violates FR-007)

---

### 2. How to measure execution time with millisecond precision?

**Decision**: Use Node.js `performance.now()` from the `perf_hooks` module

**Rationale**:

- Provides high-resolution timing (sub-millisecond precision)
- Standard Node.js API, no external dependencies
- Not affected by system clock changes (monotonic timing)
- Minimal performance overhead

**Implementation Approach**:

```typescript
import { performance } from 'perf_hooks';

const startTime = performance.now();
// ... execute command
const endTime = performance.now();
const durationMs = endTime - startTime;
```

**Alternatives Considered**:

- **Date.now()**: Rejected - lower precision (1ms), affected by system clock changes
- **process.hrtime()**: Rejected - returns array format, requires conversion, more complex API
- **External library (e.g., benchmark.js)**: Rejected - unnecessary dependency for simple timing

---

### 3. How to format structured logs for stdout with session scoping?

**Decision**: Use Pino logger with ECS (Elastic Common Schema) compliance

**Rationale**:

- Pino is one of the fastest JSON loggers for Node.js
- ECS provides standardized field naming for observability
- Dual-mode logging: pretty-printed for development, structured JSON for production
- Industry-standard schema compatible with Elasticsearch/Kibana
- Proper log levels with syslog severity codes
- Session correlation via `trace.id` field

**Log Format (Production)**:

```json
{
  "@timestamp": "2025-11-22T10:30:45.123Z",
  "log.level": "info",
  "log.syslog.severity.code": 6,
  "ecs.version": "8.11.0",
  "service.name": "playwright-server",
  "service.type": "api",
  "process.pid": 12345,
  "host.hostname": "server-1",
  "event.kind": "event",
  "event.category": ["web"],
  "event.action": "playwright-command-execution",
  "event.outcome": "success",
  "event.duration": 234560000,
  "trace.id": "abc-123-def",
  "playwright.session_id": "session-xyz",
  "playwright.command": "click",
  "playwright.command_index": 0,
  "msg": "Command executed: click"
}
```

**Log Format (Development)**:

```
[10:30:45] INFO: Command executed: click
    correlationId: "abc-123-def"
    sessionId: "session-xyz"
    command: "click"
    durationMs: 234.56
    status: "success"
```

**Implementation Approach**:

```typescript
// Pino logger with environment-aware configuration
import pino from 'pino';
import os from 'os';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label, number) => {
      // Simple in dev, ECS in production
      if (process.env.NODE_ENV === 'development') {
        return { level: label };
      }
      return {
        'log.level': label,
        'log.syslog.severity.code': LOG_LEVEL_SEVERITY[label]
      };
    }
  },
  // ECS base fields only in production
  base:
    process.env.NODE_ENV === 'development'
      ? null
      : {
          'ecs.version': '8.11.0',
          'service.name': 'playwright-server',
          'service.type': 'api',
          'process.pid': process.pid,
          'host.hostname': os.hostname()
        },
  // Pretty printing in development
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

// Proper Pino usage: object first, message second
logger.info(
  {
    'event.action': 'playwright-command-execution',
    'trace.id': correlationId,
    'playwright.session_id': sessionId,
    'playwright.command': command
  },
  `Command executed: ${command}`
);
```

**Key Design Decisions**:

1. **Message as Second Parameter**: Following Pino convention, the message string is passed as the second parameter, not as a `message` key in the object
2. **Environment-Aware Fields**: ECS metadata (service, host, process info) only added in production to keep dev logs clean
3. **Custom Field Namespace**: Playwright-specific fields use `playwright.*` prefix to avoid conflicts with ECS reserved fields
4. **Event Categorization**: Using ECS event fields (`event.kind`, `event.category`, `event.outcome`) for proper observability
5. **Duration in Nanoseconds**: Converting milliseconds to nanoseconds for ECS `event.duration` field
6. **Trace Correlation**: Using `trace.id` instead of custom `correlationId` for distributed tracing compatibility

**Alternatives Considered**:

- **Plain console.log with JSON.stringify**: Rejected - no log levels, no formatting options, manual timestamp management
- **Winston**: Rejected - slower than Pino, more complex configuration
- **Bunyan**: Rejected - less maintained, Pino is the successor
- **Custom ECS fields everywhere**: Rejected - too verbose in development, impacts developer experience
- **Message as object key**: Rejected - not idiomatic Pino usage, reduces readability

**Benefits Over Original Approach**:

- ✅ 5-10x faster than other loggers (Pino benchmarks)
- ✅ Industry-standard schema (ECS) for production
- ✅ Clean, readable logs for development
- ✅ Zero configuration for most use cases
- ✅ Compatible with log aggregation tools (Filebeat, Logstash, Fluentd)
- ✅ Proper log levels with numeric codes
- ✅ Structured fields for programmatic parsing

---

### 4. How to handle partial results when execution fails mid-sequence?

**Decision**: Return HTTP 207 Multi-Status with results array containing both successes and failure

**Rationale**:

- HTTP 207 is designed for partial success scenarios (WebDAV standard, widely understood)
- Allows API consumers to see which commands succeeded before failure
- Provides clear execution order with index-based results
- Enables debugging by showing exact failure point

**Response Format**:

```json
{
  "results": [
    { "index": 0, "command": "navigate", "status": "success", "result": null, "durationMs": 1200 },
    { "index": 1, "command": "click", "status": "success", "result": null, "durationMs": 150 },
    {
      "index": 2,
      "command": "type",
      "status": "error",
      "error": "Element not found",
      "durationMs": 50
    }
  ],
  "completedCount": 2,
  "totalCount": 5,
  "halted": true,
  "executedAt": "2025-11-22T10:30:45.123Z"
}
```

**Alternatives Considered**:

- **HTTP 500 with no partial results**: Rejected - loses valuable debugging information
- **HTTP 200 with error flags**: Rejected - misleading status code (operation didn't fully succeed)
- **Continue execution after failure**: Rejected - user explicitly chose halt-on-failure behavior
- **Custom 4xx/5xx status codes**: Rejected - 207 is more semantically correct

---

### 5. How to prevent race conditions if multiple command arrays sent to same session?

**Decision**: No explicit locking - rely on Node.js single-threaded event loop for serialization

**Rationale**:

- Node.js event loop naturally serializes async operations within a single process
- Existing command execution is already async (awaits Playwright operations)
- Express handles concurrent requests by queuing them in event loop
- Adding explicit locking would violate Simplicity First for minimal benefit

**Implementation Note**:

- Document in API documentation that concurrent requests to same session execute in arrival order
- No guaranteed ordering across parallel requests (existing behavior, unchanged)
- If users need strict ordering, they should use command arrays instead of parallel requests

**Alternatives Considered**:

- **Mutex/lock per session**: Rejected - adds complexity, unnecessary for single-threaded runtime
- **Request queue per session**: Rejected - over-engineered, Node.js already provides this
- **Reject concurrent requests**: Rejected - too restrictive, breaks existing usage patterns

---

### 6. Error handling strategy for malformed command arrays

**Decision**: Fail fast with HTTP 400 validation error before executing any commands

**Rationale**:

- Validates entire request before execution (atomic validation)
- Prevents partial execution of invalid requests
- Clear error messages for API consumers
- Consistent with existing single-command validation

**Validation Checks**:

1. Array is not empty (`length > 0`)
2. Each element is a valid command object (has required `command` field)
3. Each command name exists in command registry
4. Required parameters present for each command (selector, url, etc.)

**Implementation Approach**:

```typescript
// In route handler, before calling service
if (Array.isArray(commands)) {
  if (commands.length === 0) {
    throw new ValidationError('Command array cannot be empty');
  }
  commands.forEach((cmd, index) => {
    if (!cmd.command || typeof cmd.command !== 'string') {
      throw new ValidationError(`Invalid command at index ${index}: missing command field`);
    }
  });
}
```

**Alternatives Considered**:

- **Validate during execution**: Rejected - leads to partial execution before errors detected
- **Skip invalid commands**: Rejected - silent failures are dangerous
- **Lenient validation**: Rejected - fails fast principle is clearer

---

## Technology Decisions

### Performance Timing

- **Choice**: Node.js `perf_hooks` module's `performance.now()`
- **Version**: Built-in to Node.js 8.5+, stable API
- **Rationale**: High precision, no dependencies, standard library

### Logging

- **Choice**: Pino with ECS (Elastic Common Schema) compliance
- **Dependencies**: `pino`, `pino-pretty` (dev)
- **Format**:
  - Production: Single-line ECS-compliant JSON
  - Development: Human-readable pretty-printed logs
- **Rationale**:
  - Industry-standard observability with ECS
  - High performance (fastest Node.js logger)
  - Environment-aware formatting
  - Compatible with log aggregation tools (Elasticsearch, Kibana, Filebeat)
  - Proper Pino convention: `logger.info(object, message)` not `logger.info({..., message})`

### Type System

- **Choice**: TypeScript union types for flexible input
- **Rationale**: Type safety + runtime flexibility
- **Additional Types Needed**:
  - `CommandSequenceRequest` (extends existing `CommandRequest`)
  - `CommandExecutionResult` (includes timing data)
  - `SequenceExecutionResponse` (multi-status response)

### Error Handling

- **Choice**: HTTP 207 Multi-Status for partial failures
- **Rationale**: Semantic correctness, industry standard for partial success

---

## Best Practices Applied

### 1. Backward Compatibility

- Existing single-command requests work unchanged
- Union type `Command | Command[]` enables gradual migration
- Response format extends existing structure (adds timing field)

### 2. Performance

- Minimal overhead: timing adds ~1μs per command
- No additional memory allocation (results streamed)
- No blocking operations introduced

### 3. Observability

- Structured logs enable filtering with ECS-aware tools (Kibana, Grafana)
- Trace correlation via `trace.id` field for distributed tracing
- Timestamp with ISO 8601 format (`@timestamp`)
- Command index for sequence correlation
- Event categorization for proper observability dashboards
- Environment-specific verbosity (verbose in production, clean in dev)

### 4. Developer Experience

- Clear error messages with command index
- Partial results show progress before failure
- TypeScript types guide correct usage
- HTTP status codes follow standards

---

## Integration Patterns

### With Existing Code

**Command Service** (`src/services/command.ts`):

- Extract existing `executeCommand` logic into internal helper
- Add new `executeCommandSequence` function that loops over array
- Measure timing around each command execution
- Collect results in array, halt on first error

**Command Route** (`src/routes/command.ts`):

- Accept `command | commands` in request body
- Normalize single command to array internally
- Call appropriate service function
- Return appropriate HTTP status (200 for full success, 207 for partial)

**Type Definitions** (`src/types/command.ts`):

- Add `CommandExecutionResult` with `durationMs` field
- Add `SequenceExecutionResponse` type
- Export union type for request input

**Logger Utility** (`src/utils/logger.ts`):

- Configure Pino with environment-aware settings
- Export logger instance for use across modules
- Export `logCommandExecution` helper function
- ECS field mapping (production) vs simple fields (development)
- Sanitization helpers for sensitive data (passwords, tokens)

---

## Open Questions

None - all technical questions resolved during research phase.

---

## References

- Node.js `perf_hooks` documentation: https://nodejs.org/api/perf_hooks.html
- HTTP 207 Multi-Status specification: RFC 4918
- TypeScript union types: https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html
- Express request handling: https://expressjs.com/en/guide/routing.html
- Pino documentation: https://getpino.io/
- Elastic Common Schema (ECS): https://www.elastic.co/guide/en/ecs/current/index.html
- RFC 5424 Syslog severity levels: https://datatracker.ietf.org/doc/html/rfc5424
