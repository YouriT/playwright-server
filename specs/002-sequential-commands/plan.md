# Implementation Plan: Sequential Command Execution with Timing and Logging

**Branch**: `002-sequential-commands` | **Date**: 2025-11-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-sequential-commands/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable API consumers to execute multiple Playwright commands in a single HTTP request, returning execution time for each command and writing session-scoped logs to stdout. The implementation extends the existing `/sessions/:id/command` endpoint to accept either a single command object (backward compatible) or an array of commands. On failure, execution halts and returns partial results. All execution details are logged to stdout in JSON format with session ID for filtering.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode enabled), Node.js LTS (20.x or later)  
**Primary Dependencies**: Express 5.1.0, Patchright 1.56.1, uuid 13.0.0  
**Storage**: In-memory session store (no changes required)  
**Testing**: None (per constitution - tests not required for hobby projects)  
**Target Platform**: Node.js server (Linux/macOS/Windows compatible)  
**Project Type**: Single project (HTTP server)  
**Performance Goals**: Minimal overhead (<5% of total command execution time), per-command latency unchanged  
**Constraints**: Standard HTTP timeouts apply, execution halts on first failure  
**Scale/Scope**: Extend existing command endpoint, modify command.ts route/service, add stdout logging utility

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Initial Check (Before Phase 0) ✅

#### Principle I: Simplicity First ✅

- **Status**: PASS
- **Analysis**: Feature extends existing endpoint with straightforward array handling. No new abstractions or design patterns introduced. Single-file changes to route and service layers.
- **Rationale**: Implementing sequential execution with a simple loop, timing with performance.now(), and stdout logging with console.log maintains simplicity.

#### Principle II: TypeScript Foundation ✅

- **Status**: PASS
- **Analysis**: All code uses TypeScript strict mode (already enabled). Type definitions for command arrays, execution results with timing, and log entries are straightforward.
- **Changes**: Add types for CommandSequenceRequest, CommandExecutionResult (with timing), and modify existing types to support arrays.

#### Principle III: HTTP-First Interface ✅

- **Status**: PASS
- **Analysis**: Extends existing REST endpoint `/sessions/:id/command` to accept array payloads. Maintains backward compatibility with single command objects.
- **Changes**: Request body validation updated to accept `command | command[]`, response includes timing for each result.

#### Principle IV: Thin Playwright Wrapper ✅

- **Status**: PASS
- **Analysis**: No changes to Playwright interaction layer. Commands still execute via existing command handlers. Only orchestration (looping, timing, logging) added.
- **Rationale**: Preserves direct mapping from HTTP commands to Playwright API calls.

#### Principle V: No Testing Requirements ✅

- **Status**: PASS (NON-NEGOTIABLE)
- **Analysis**: No tests required or planned. TypeScript's type system ensures type safety. Manual testing with curl/Postman sufficient.
- **Validation**: Manual testing scenarios documented in spec's acceptance criteria.

**Initial Gate Status**: ✅ PASS - All constitutional principles satisfied.

---

### Post-Design Check (After Phase 1) ✅

#### Principle I: Simplicity First ✅

- **Status**: PASS (Confirmed)
- **Analysis**: Design maintains simplicity commitment:
  - No new dependencies added
  - Single utility file added (`src/utils/logger.ts`) with 20 lines
  - Existing command execution logic reused (no duplication)
  - Simple for-loop for sequential execution (no complex orchestration)
- **Files Modified**: 3 files (routes/command.ts, services/command.ts, types/command.ts)
- **Files Added**: 1 file (utils/logger.ts)
- **Rationale**: Minimal code changes, straightforward logic, no architectural complexity

#### Principle II: TypeScript Foundation ✅

- **Status**: PASS (Confirmed)
- **Analysis**: Type definitions remain simple and clear:
  - Union types for flexible input (`Command | Command[]`)
  - Interface extensions use simple types (no generics or advanced constructs)
  - All types have clear purpose and minimal fields
- **Type Safety**: Full type coverage with no `any` escapes needed
- **Rationale**: Types guide correct usage without complexity

#### Principle III: HTTP-First Interface ✅

- **Status**: PASS (Confirmed)
- **Analysis**: HTTP contract remains clean:
  - Single endpoint modified (no new routes)
  - RESTful conventions maintained
  - HTTP 207 Multi-Status used correctly (industry standard)
  - OpenAPI 3.1 contract provides clear documentation
- **Backward Compatibility**: 100% - existing single-command requests unchanged
- **Rationale**: HTTP remains the primary interface, simple to use with curl/Postman

#### Principle IV: Thin Playwright Wrapper ✅

- **Status**: PASS (Confirmed)
- **Analysis**: Wrapper remains thin:
  - No new Playwright abstractions created
  - Existing command handlers unchanged
  - Only orchestration layer added (loop + timing + logging)
  - Direct Playwright API calls preserved
- **Complexity Added**: Orchestration only (timing, logging, error handling)
- **Rationale**: Still a thin wrapper - just orchestrating existing commands

#### Principle V: No Testing Requirements ✅

- **Status**: PASS (Confirmed - NON-NEGOTIABLE)
- **Analysis**: No tests added or planned:
  - Manual testing documented in quickstart.md
  - TypeScript catches type errors at compile time
  - Express error middleware handles runtime errors
  - Acceptance criteria in spec define validation scenarios
- **Validation Approach**: Manual curl/Postman testing, TypeScript compilation
- **Rationale**: Hobby project principle maintained

**Post-Design Gate Status**: ✅ PASS - All constitutional principles satisfied after design phase.

---

**Overall Constitution Compliance**: ✅ FULLY COMPLIANT

No violations detected. Design maintains all five core principles without compromise.

## Project Structure

### Documentation (this feature)

```text
specs/002-sequential-commands/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── openapi.yaml     # API contract with command array support
├── spec.md              # Feature specification (already created)
└── checklists/
    └── requirements.md  # Spec quality checklist (already created)
```

### Source Code (repository root)

```text
src/
├── middleware/
│   └── error.ts         # Error handling (existing, no changes)
├── routes/
│   ├── command.ts       # [MODIFY] Add array support for command execution
│   └── session.ts       # Session management (existing, no changes)
├── services/
│   ├── browser.ts       # Browser management (existing, no changes)
│   ├── command.ts       # [MODIFY] Add sequential execution logic with timing
│   ├── recording.ts     # Recording service (existing, no changes)
│   └── session.ts       # Session service (existing, no changes)
├── types/
│   ├── command.ts       # [MODIFY] Add array types and execution result with timing
│   ├── errors.ts        # Error types (existing, no changes)
│   ├── recording.ts     # Recording types (existing, no changes)
│   └── session.ts       # Session types (existing, no changes)
├── utils/
│   ├── ttl.ts           # TTL utilities (existing, no changes)
│   └── logger.ts        # [NEW] Stdout logging utility for session-scoped logs
└── server.ts            # Express server setup (existing, no changes)
```

**Structure Decision**: Single project structure maintained. This is a straightforward extension to the existing HTTP command execution endpoint. Changes isolated to:

1. **src/routes/command.ts** - Accept array in request body
2. **src/services/command.ts** - Sequential execution loop with timing
3. **src/types/command.ts** - Type definitions for arrays and timed results
4. **src/utils/logger.ts** - New utility for structured stdout logging

No new directories or significant structural changes needed.

## Complexity Tracking

> **No violations detected - this section is empty**

This feature introduces no architectural complexity:

- No new design patterns or abstractions
- No additional dependencies
- Simple loop-based sequential execution
- Standard performance timing with Node.js built-ins
- Console-based logging with no persistent storage

All constitutional principles are satisfied without trade-offs.

---

## Phase Completion Summary

### Phase 0: Research ✅ COMPLETE

**Deliverable**: `research.md` (302 lines)

**Questions Resolved**:

1. ✅ Backward compatibility strategy (union types + runtime check)
2. ✅ Timing measurement approach (performance.now())
3. ✅ Structured logging format (JSON to stdout)
4. ✅ Partial failure handling (HTTP 207 Multi-Status)
5. ✅ Race condition prevention (Node.js event loop serialization)
6. ✅ Request validation strategy (fail fast before execution)

**Technology Decisions**:

- Performance timing: `perf_hooks` module (built-in)
- Logging: JSON `console.log()` to stdout
- Type system: TypeScript union types
- Error handling: HTTP 207 for partial success

---

### Phase 1: Design & Contracts ✅ COMPLETE

**Deliverables**:

- `data-model.md` (346 lines) - Complete data model with 5 entities
- `contracts/openapi.yaml` (347 lines) - OpenAPI 3.1 contract
- `quickstart.md` (547 lines) - Implementation guide with code examples

**Entities Defined**:

1. CommandRequest (existing, extended)
2. CommandSequenceRequest (new union type)
3. CommandExecutionResult (new, with timing)
4. SequenceExecutionResponse (new, multi-status)
5. SessionLogEntry (new, stdout logging)

**API Contract**:

- Endpoint: `POST /sessions/{sessionId}/command`
- Input: Single command OR array of commands
- Success: HTTP 200 (full success) or 207 (partial success)
- Errors: 400 (validation), 404 (session), 500 (server)

**Agent Context**: ✅ Updated (`AGENTS.md` synchronized)

---

## Implementation Readiness

### Code Changes Required

| File                      | Change Type | Estimated Lines | Complexity     |
| ------------------------- | ----------- | --------------- | -------------- |
| `src/types/command.ts`    | Extend      | +40             | Low            |
| `src/utils/logger.ts`     | New         | +25             | Low            |
| `src/services/command.ts` | Extend      | +80             | Medium         |
| `src/routes/command.ts`   | Modify      | +50             | Medium         |
| **Total**                 |             | **~195 lines**  | **Low-Medium** |

### No Breaking Changes

- Existing API calls work unchanged
- No dependency updates required
- No database migrations needed
- No configuration changes needed

---

## Next Phase

**Phase 2**: Task Breakdown (separate command: `/speckit.tasks`)

Not included in this plan output. Run `/speckit.tasks` to generate:

- Detailed task breakdown
- Implementation order
- Testing scenarios
- Acceptance criteria per task

---

## Artifact Inventory

```
specs/002-sequential-commands/
├── spec.md              ✅ (106 lines) - Feature specification
├── plan.md              ✅ (180 lines) - This implementation plan
├── research.md          ✅ (302 lines) - Technical research & decisions
├── data-model.md        ✅ (346 lines) - Entity definitions & relationships
├── quickstart.md        ✅ (547 lines) - Developer implementation guide
├── contracts/
│   └── openapi.yaml     ✅ (347 lines) - API contract
└── checklists/
    └── requirements.md  ✅ (Validated) - Spec quality checklist

Total Documentation: ~1,828 lines
```

---

## Key Takeaways

### Design Principles Applied

1. **Simplicity**: No new abstractions, ~195 lines of code
2. **Backward Compatible**: Existing API unchanged
3. **Type Safe**: Full TypeScript coverage
4. **Observable**: Structured stdout logs with session ID
5. **Standards-Based**: HTTP 207, OpenAPI 3.1, JSON logging

### Performance Characteristics

- **Overhead**: <5% of total execution time (target: <100μs per command)
- **Memory**: Linear scaling (~100 bytes per command)
- **Scalability**: No architectural changes, existing concurrency model

### Risk Assessment

- **Low Risk**: Extends existing endpoint, no breaking changes
- **Low Complexity**: Simple orchestration layer, no new patterns
- **High Testability**: Manual testing sufficient (curl/Postman)

---

**Plan Status**: ✅ COMPLETE (Phases 0-1)  
**Ready for**: Implementation (`/speckit.tasks` for task breakdown)  
**Estimated Implementation Time**: 2-4 hours for experienced TypeScript/Express developer
