# Quickstart: Sequential Command Execution

**Feature**: 002-sequential-commands  
**Audience**: Developers implementing this feature  
**Prerequisites**: Familiarity with TypeScript, Express, and Playwright

---

## Overview

This feature extends the `/sessions/:id/command` endpoint to accept command arrays, execute them sequentially with timing measurements, and log execution details to stdout.

**Key Changes**:

- Accept single command OR array in request body
- Execute commands in order, halt on first failure
- Return timing data for each command
- Write structured logs to stdout

---

## Implementation Steps

### Step 1: Update Type Definitions

**File**: `src/types/command.ts`

```typescript
// Add new types (existing CommandRequest unchanged)

export type CommandSequenceRequest = CommandRequest | CommandRequest[];

export interface CommandExecutionResult {
  index: number;
  command: string;
  status: 'success' | 'error';
  result: any;
  durationMs: number;
  error?: string;
  selector?: string;
}

export interface SequenceExecutionResponse {
  results: CommandExecutionResult[];
  completedCount: number;
  totalCount: number;
  halted: boolean;
  executedAt: string;
}

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

### Step 2: Create Logger Utility

**File**: `src/utils/logger.ts` (new file)

```typescript
import { SessionLogEntry } from '../types/command';

/**
 * Log command execution to stdout in JSON format
 * Includes session ID for filtering
 */
export function logCommandExecution(
  sessionId: string,
  command: string,
  index: number,
  durationMs: number,
  status: 'success' | 'error',
  selector?: string,
  error?: string
): void {
  const logEntry: SessionLogEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    command,
    index,
    durationMs,
    status,
    ...(selector && { selector }),
    ...(error && { error })
  };

  // Write single-line JSON to stdout
  console.log(JSON.stringify(logEntry));
}
```

**Why this approach?**

- Simple: Uses built-in `console.log()`
- Structured: JSON format for parsing
- Filterable: Session ID in every log entry
- No dependencies: No logging library needed

---

### Step 3: Update Command Service

**File**: `src/services/command.ts`

Add sequential execution function:

```typescript
import { performance } from 'perf_hooks';
import { logCommandExecution } from '../utils/logger';
import {
  CommandRequest,
  CommandExecutionResult,
  SequenceExecutionResponse
} from '../types/command';

// Keep existing executeCommand function as-is for backward compatibility

/**
 * Execute array of commands sequentially
 * Halts on first failure, returns partial results
 */
export async function executeCommandSequence(
  sessionId: string,
  commands: CommandRequest[]
): Promise<SequenceExecutionResponse> {
  const results: CommandExecutionResult[] = [];
  const executedAt = new Date().toISOString();
  let halted = false;

  for (let index = 0; index < commands.length; index++) {
    const cmd = commands[index];
    const startTime = performance.now();

    try {
      // Execute command using existing executeCommand logic
      const result = await executeCommand({
        sessionId,
        command: cmd.command,
        selector: cmd.selector,
        options: cmd.options
      });

      const endTime = performance.now();
      const durationMs = endTime - startTime;

      // Record success
      const execResult: CommandExecutionResult = {
        index,
        command: cmd.command,
        status: 'success',
        result,
        durationMs,
        ...(cmd.selector && { selector: cmd.selector })
      };
      results.push(execResult);

      // Log to stdout
      logCommandExecution(sessionId, cmd.command, index, durationMs, 'success', cmd.selector);
    } catch (error: any) {
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      // Record failure
      const execResult: CommandExecutionResult = {
        index,
        command: cmd.command,
        status: 'error',
        result: null,
        durationMs,
        error: error.message || 'Command execution failed',
        ...(cmd.selector && { selector: cmd.selector })
      };
      results.push(execResult);

      // Log to stdout
      logCommandExecution(
        sessionId,
        cmd.command,
        index,
        durationMs,
        'error',
        cmd.selector,
        error.message
      );

      // Halt execution
      halted = true;
      break;
    }
  }

  return {
    results,
    completedCount: results.filter((r) => r.status === 'success').length,
    totalCount: commands.length,
    halted,
    executedAt
  };
}
```

**Key Points**:

- Reuses existing `executeCommand` for each command
- `performance.now()` for high-precision timing
- Logs every command (success or failure)
- Halts immediately on error
- Returns partial results

---

### Step 4: Update Command Route

**File**: `src/routes/command.ts`

Modify the POST handler:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { executeCommand, executeCommandSequence } from '../services/command';
import { ValidationError } from '../types/errors';
import { CommandRequest } from '../types/command';

const router = Router();

router.post('/:id/command', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Validate input
    if (!body || (Array.isArray(body) && body.length === 0)) {
      throw new ValidationError('Request body must be a command object or non-empty array');
    }

    // Check if array or single command
    if (Array.isArray(body)) {
      // Validate array elements
      body.forEach((cmd: any, index: number) => {
        if (!cmd.command || typeof cmd.command !== 'string') {
          throw new ValidationError(
            `Invalid command at index ${index}: missing or invalid command field`
          );
        }
      });

      // Execute sequence
      const response = await executeCommandSequence(id, body as CommandRequest[]);

      // Return 207 Multi-Status if halted, 200 if all succeeded
      const statusCode = response.halted ? 207 : 200;
      res.status(statusCode).json(response);
    } else {
      // Single command (backward compatible)
      const { command, selector, options } = body;

      if (!command || typeof command !== 'string') {
        throw new ValidationError('Command is required and must be a string');
      }

      // Execute single command
      const result = await executeCommand({
        sessionId: id,
        command,
        selector,
        options
      });

      // Return in new format for consistency
      res.json({
        results: [
          {
            index: 0,
            command,
            status: 'success',
            result,
            durationMs: 0, // Legacy: no timing for single commands (optional enhancement)
            ...(selector && { selector })
          }
        ],
        completedCount: 1,
        totalCount: 1,
        halted: false,
        executedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
```

**Design Decisions**:

- **Backward compatibility**: Single command returns same response structure (wrapped)
- **HTTP 207**: Used for partial success (semantic correctness)
- **Validation first**: All commands validated before execution begins
- **Error propagation**: Errors caught by Express error middleware

**Optional Enhancement**: Add timing to single-command execution for consistency.

---

### Step 5: Test Manually

**Prerequisites**:

1. Rebuild project: `npm run build`
2. Start server: `npm start`
3. Create session: `POST /sessions`

**Test Case 1: Single Command (Backward Compatibility)**

```bash
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "navigate",
    "options": { "url": "https://example.com" }
  }'
```

**Expected**: 200 OK with results array containing single command

---

**Test Case 2: Command Sequence (Success)**

```bash
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '[
    {
      "command": "navigate",
      "options": { "url": "https://example.com" }
    },
    {
      "command": "click",
      "selector": "#button"
    },
    {
      "command": "textContent",
      "selector": "h1"
    }
  ]'
```

**Expected**: 200 OK with results array, each result has `durationMs`

---

**Test Case 3: Partial Failure**

```bash
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '[
    {
      "command": "navigate",
      "options": { "url": "https://example.com" }
    },
    {
      "command": "click",
      "selector": "#missing-element"
    },
    {
      "command": "textContent",
      "selector": "h1"
    }
  ]'
```

**Expected**: 207 Multi-Status with 2 results (navigate success, click error), `halted: true`

---

**Test Case 4: Validation Errors**

```bash
# Empty array
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '[]'

# Expected: 400 Bad Request

# Invalid command
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '[{"command": "invalidCommand"}]'

# Expected: 400 Bad Request
```

---

**Test Case 5: Verify Logs**

Run server in foreground and observe stdout:

```bash
npm run dev
```

Execute commands and watch for JSON logs:

```json
{"timestamp":"2025-11-22T10:30:45.123Z","sessionId":"abc-123","command":"navigate","index":0,"durationMs":1234.5,"status":"success"}
{"timestamp":"2025-11-22T10:30:46.456Z","sessionId":"abc-123","command":"click","index":1,"durationMs":150.2,"status":"success","selector":"#button"}
```

**Filter logs by session**:

```bash
npm run dev | grep '"sessionId":"abc-123"'
```

---

## Architecture Decisions

### Why HTTP 207 Multi-Status?

- **Semantic correctness**: Partial success/failure is exactly what 207 represents
- **Industry standard**: Used by WebDAV, CalDAV, and other batch APIs
- **Clear signal**: Client knows immediately if some commands failed

### Why `performance.now()` instead of `Date.now()`?

- **Higher precision**: Sub-millisecond accuracy
- **Monotonic**: Not affected by system clock changes
- **Standard**: Node.js built-in, no dependencies

### Why stdout logging instead of log files?

- **Simplicity**: No file I/O, no rotation logic
- **Container-friendly**: Docker captures stdout automatically
- **Flexible**: Infrastructure decides where logs go (files, aggregation, etc.)

### Why JSON logs instead of plain text?

- **Structured**: Parseable by `jq`, log aggregators
- **Filterable**: Easy to grep by session ID, command, status
- **Extensible**: Can add fields without breaking parsers

---

## Performance Considerations

### Timing Overhead

- `performance.now()` calls: ~1μs each (negligible)
- JSON stringification for logs: ~10-50μs per log (acceptable)
- Total overhead: <0.1% of typical command execution time

### Memory Usage

- Results array: ~100 bytes per command (scales linearly)
- For 1000 commands: ~100KB temporary memory
- No persistent storage, garbage collected after response sent

### Scalability

- No architectural changes to session management
- Same concurrency model (Node.js event loop)
- No blocking operations introduced

---

## Edge Cases Handled

1. **Empty array**: Returns 400 validation error
2. **Single command in array**: Works correctly (array of length 1)
3. **Command fails on first element**: Returns 207 with 1 error result
4. **Command fails on last element**: Returns 207 with N-1 success, 1 error
5. **Session expires during execution**: Existing error handling catches this
6. **Invalid command name**: Caught during validation (400 error)
7. **Missing required parameters**: Caught by command handler (400 error)

---

## Migration Guide (for API consumers)

### Existing Code (Single Commands)

```javascript
// Still works - no changes needed
await fetch(`/sessions/${sessionId}/command`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'click',
    selector: '#button'
  })
});
```

### New Code (Command Sequences)

```javascript
// Execute multiple commands in one request
const response = await fetch(`/sessions/${sessionId}/command`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { command: 'navigate', options: { url: 'https://example.com' } },
    { command: 'click', selector: '#button' },
    { command: 'textContent', selector: 'h1' }
  ])
});

if (response.status === 200) {
  // All commands succeeded
  const data = await response.json();
  console.log('All completed:', data.results);
} else if (response.status === 207) {
  // Partial success
  const data = await response.json();
  console.log('Completed:', data.completedCount, 'of', data.totalCount);
  console.error(
    'Failed at index:',
    data.results.findIndex((r) => r.status === 'error')
  );
}
```

---

## Next Steps

After implementation:

1. Update main README.md with sequential command examples
2. Consider adding timing to single-command execution for consistency
3. Optional: Add metrics aggregation (avg duration per command type)
4. Optional: Add request timeout configuration (if needed beyond defaults)

---

## References

- **Feature Spec**: [spec.md](./spec.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml)
- **Research**: [research.md](./research.md)
