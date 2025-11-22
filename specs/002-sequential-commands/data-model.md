# Data Model: Sequential Command Execution

**Feature**: 002-sequential-commands  
**Date**: 2025-11-22  
**Source**: spec.md Key Entities section

## Overview

This feature extends the existing command execution model to support arrays of commands with timing data and structured logging. The data model remains simple with no persistent storage - all data flows through request/response cycles or stdout logs.

---

## Core Entities

### 1. CommandRequest (existing, extended)

Represents a single command to execute in a browser session.

**Fields**:

- `command: string` - Command name (e.g., "click", "navigate", "type") [required]
- `selector?: string` - CSS selector for element-based commands [optional]
- `options?: Record<string, any>` - Command-specific options (url, text, timeout, etc.) [optional]

**Validation Rules**:

- `command` must be non-empty string
- `command` must exist in command registry
- Required options vary by command type (handled in service layer)

**Example**:

```typescript
{
  command: "click",
  selector: "#submit-button",
  options: { timeout: 5000 }
}
```

---

### 2. CommandSequenceRequest (new)

Represents the request body, supporting both single commands and arrays.

**Type Definition**:

```typescript
type CommandSequenceRequest = CommandRequest | CommandRequest[];
```

**Validation Rules**:

- If array, must have length > 0
- Each element must be valid `CommandRequest`
- All commands validated before execution begins

**Examples**:

Single command (backward compatible):

```json
{
  "command": "navigate",
  "options": { "url": "https://example.com" }
}
```

Command sequence:

```json
[
  {
    "command": "navigate",
    "options": { "url": "https://example.com" }
  },
  {
    "command": "click",
    "selector": "#login-button"
  },
  {
    "command": "type",
    "selector": "#username",
    "options": { "text": "user@example.com" }
  }
]
```

---

### 3. CommandExecutionResult (new)

Represents the outcome of a single command execution with timing data.

**Fields**:

- `index: number` - Position in command sequence (0-based) [required]
- `command: string` - Command name that was executed [required]
- `status: 'success' | 'error'` - Execution outcome [required]
- `result: any` - Command return value (null for void commands) [nullable]
- `durationMs: number` - Execution time in milliseconds [required]
- `error?: string` - Error message if status is 'error' [optional]
- `selector?: string` - Selector used (for context in logs) [optional]

**Validation Rules**:

- `durationMs` must be non-negative
- `error` field present only when status is 'error'
- `result` may be null, string, object, or array depending on command

**State Transitions**:

- Command starts → status initially undefined
- Command succeeds → status = 'success', result populated, durationMs recorded
- Command fails → status = 'error', error message populated, durationMs recorded

**Example (success)**:

```json
{
  "index": 0,
  "command": "navigate",
  "status": "success",
  "result": null,
  "durationMs": 1234.56
}
```

**Example (failure)**:

```json
{
  "index": 2,
  "command": "click",
  "selector": "#missing-element",
  "status": "error",
  "error": "Element not found: #missing-element",
  "durationMs": 30.12
}
```

---

### 4. SequenceExecutionResponse (new)

Represents the complete response for command sequence execution.

**Fields**:

- `results: CommandExecutionResult[]` - Array of individual command results [required]
- `completedCount: number` - Number of successfully executed commands [required]
- `totalCount: number` - Total number of commands in request [required]
- `halted: boolean` - True if execution stopped due to failure [required]
- `executedAt: string` - ISO 8601 timestamp of execution start [required]

**Validation Rules**:

- `results.length === completedCount` (if no errors) or `completedCount + 1` (if error occurred)
- `totalCount >= completedCount`
- `halted === true` implies last result has status 'error'

**HTTP Status Codes**:

- 200 OK: All commands succeeded (`halted === false`)
- 207 Multi-Status: Some commands succeeded, then failure occurred (`halted === true`)
- 400 Bad Request: Request validation failed (before execution)
- 404 Not Found: Session not found
- 500 Internal Server Error: Unexpected server error

**Example (full success)**:

```json
{
  "results": [
    { "index": 0, "command": "navigate", "status": "success", "result": null, "durationMs": 1200 },
    { "index": 1, "command": "click", "status": "success", "result": null, "durationMs": 150 }
  ],
  "completedCount": 2,
  "totalCount": 2,
  "halted": false,
  "executedAt": "2025-11-22T10:30:45.123Z"
}
```

**Example (partial failure)**:

```json
{
  "results": [
    { "index": 0, "command": "navigate", "status": "success", "result": null, "durationMs": 1200 },
    {
      "index": 1,
      "command": "click",
      "status": "error",
      "error": "Timeout: 30000ms exceeded",
      "durationMs": 30050
    }
  ],
  "completedCount": 1,
  "totalCount": 5,
  "halted": true,
  "executedAt": "2025-11-22T10:30:45.123Z"
}
```

---

### 5. SessionLogEntry (new)

Represents a single structured log line written to stdout for session-scoped logging.

**Fields**:

- `timestamp: string` - ISO 8601 timestamp with milliseconds [required]
- `sessionId: string` - Session UUID [required]
- `command: string` - Command name [required]
- `index: number` - Position in sequence (0-based) [required]
- `durationMs: number` - Execution time in milliseconds [required]
- `status: 'success' | 'error'` - Execution outcome [required]
- `error?: string` - Error message if status is 'error' [optional]
- `selector?: string` - Selector if applicable [optional]

**Output Format**: Single-line JSON written to stdout via `console.log()`

**Example (stdout)**:

```json
{
  "timestamp": "2025-11-22T10:30:45.123Z",
  "sessionId": "abc-123-def",
  "command": "click",
  "index": 1,
  "durationMs": 150.5,
  "status": "success",
  "selector": "#submit-btn"
}
```

**Filtering Examples**:

```bash
# Filter by session ID
cat server.log | jq 'select(.sessionId == "abc-123-def")'

# Filter by command type
cat server.log | grep '"command":"navigate"'

# Filter errors only
cat server.log | jq 'select(.status == "error")'

# Calculate average duration per command
cat server.log | jq -s 'group_by(.command) | map({command: .[0].command, avgMs: (map(.durationMs) | add / length)})'
```

---

## Relationships

```
CommandSequenceRequest (1)
    ↓
    contains
    ↓
CommandRequest (1..N)
    ↓
    executes to
    ↓
CommandExecutionResult (1..N)
    ↓
    aggregates to
    ↓
SequenceExecutionResponse (1)

CommandExecutionResult (1)
    ↓
    logs to stdout as
    ↓
SessionLogEntry (1)
```

**Flow**:

1. Client sends `CommandSequenceRequest` (single or array)
2. Server validates and normalizes to array
3. For each `CommandRequest`:
   - Execute command
   - Measure timing
   - Create `CommandExecutionResult`
   - Write `SessionLogEntry` to stdout
   - If error: halt and skip remaining commands
4. Return `SequenceExecutionResponse` with all results

---

## No Persistent Storage

**Key Design Decision**: All data is ephemeral

- No database tables
- No in-memory caching of execution history
- Logs written to stdout (captured by external infrastructure)
- Execution results returned in HTTP response only

**Rationale** (from constitution):

- Simplicity First: No database dependencies
- Thin Wrapper: Just orchestrating Playwright calls
- Hobby Project: External log aggregation sufficient

---

## TypeScript Type Definitions

```typescript
// src/types/command.ts

// Existing type (unchanged)
export interface CommandRequest {
  command: string;
  selector?: string;
  options?: Record<string, any>;
}

// New: Union type for flexible input
export type CommandSequenceRequest = CommandRequest | CommandRequest[];

// New: Result with timing
export interface CommandExecutionResult {
  index: number;
  command: string;
  status: 'success' | 'error';
  result: any;
  durationMs: number;
  error?: string;
  selector?: string;
}

// New: Response envelope
export interface SequenceExecutionResponse {
  results: CommandExecutionResult[];
  completedCount: number;
  totalCount: number;
  halted: boolean;
  executedAt: string;
}

// New: Log entry structure
export interface SessionLogEntry {
  timestamp: string;
  sessionId: string;
  command: string;
  index: number;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
  selector?: string;
}
```

---

## Validation Summary

### Request Validation (before execution)

- ✅ Input is valid JSON
- ✅ Input matches `CommandSequenceRequest` type
- ✅ Array is not empty (if array)
- ✅ Each command has required `command` field
- ✅ Command names exist in registry

### Response Validation (after execution)

- ✅ Results array length matches execution count
- ✅ Each result has valid status ('success' | 'error')
- ✅ Duration is non-negative number
- ✅ Error field present only when status is 'error'
- ✅ Timestamps are valid ISO 8601 format

### Log Validation (stdout output)

- ✅ Valid single-line JSON
- ✅ All required fields present
- ✅ Session ID is valid UUID
- ✅ Status is 'success' or 'error'
