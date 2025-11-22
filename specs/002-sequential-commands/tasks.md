# Implementation Tasks: Sequential Command Execution with Timing and Logging

**Feature**: 002-sequential-commands  
**Branch**: `002-sequential-commands`  
**Created**: 2025-11-22  
**Status**: Ready for Implementation

---

## Overview

This feature extends the `/sessions/:id/command` endpoint to support sequential execution of command arrays with timing data and structured logging to stdout. Implementation is organized by user story priority to enable incremental delivery and independent testing.

**Estimated Total Effort**: 2-4 hours  
**Total Tasks**: 16 tasks across 5 phases  
**Parallelization**: 6 tasks can be executed in parallel

---

## Implementation Strategy

### MVP Scope (Recommended First Increment)

**Target**: User Story 1 only - Sequential command execution without timing or logging

- Enables API consumers to execute command arrays
- Delivers immediate value
- ~1-2 hours of work
- 100% backward compatible

### Full Feature Scope

**Target**: All 3 user stories - Complete feature with timing and logging

- MVP + timing measurements + stdout logging
- Full production-ready feature
- ~2-4 hours total work

---

## User Story Dependency Graph

```
Phase 1: Setup (Foundational)
    ↓
Phase 2: User Story 1 (P1) - Sequential Execution ← MVP ENDS HERE
    ↓ (independent)
    ├─→ Phase 3: User Story 2 (P2) - Timing Measurement
    │   (can be developed in parallel with US3 once US1 is complete)
    │
    └─→ Phase 4: User Story 3 (P3) - Stdout Logging
        (can be developed in parallel with US2 once US1 is complete)
    ↓
Phase 5: Polish & Documentation
```

**Key Independence**:

- User Story 2 (timing) and User Story 3 (logging) are fully independent
- Both US2 and US3 only depend on US1 being complete
- US2 and US3 can be implemented in parallel by different developers

---

## Phase 1: Setup & Foundational

**Goal**: Establish type definitions and utility infrastructure needed by all user stories

**Duration**: 15-20 minutes

### Tasks

- [x] T001 [P] Create new TypeScript interfaces for command sequence types in /Users/Youri/Projects/playwright-server/src/types/command.ts
- [x] T002 Verify TypeScript compilation passes with new types using `npm run build`

**Independent Test Criteria**:

- TypeScript compilation succeeds without errors
- All new types exported correctly from command.ts module
- No breaking changes to existing CommandRequest interface

---

## Phase 2: User Story 1 (P1) - Sequential Command Execution

**User Story**: API consumers need to execute multiple browser automation commands as a single atomic operation without making separate HTTP requests for each step.

**Goal**: Enable command array execution that halts on first failure, returns partial results, and maintains backward compatibility with single-command requests.

**Duration**: 45-60 minutes

### Tasks

- [ ] T003 [US1] Add executeCommandSequence function in /Users/Youri/Projects/playwright-server/src/services/command.ts with basic loop logic (no timing yet)
- [ ] T004 [US1] Update command route POST handler in /Users/Youri/Projects/playwright-server/src/routes/command.ts to accept array input and validate
- [ ] T005 [US1] Implement array validation logic in command route (empty array check, command field validation)
- [ ] T006 [US1] Add HTTP 207 Multi-Status response handling for partial failures in command route
- [ ] T007 [US1] Update single command handling to return new SequenceExecutionResponse format for consistency

**Independent Test Criteria for US1**:
✅ **Test 1**: Send array of 3 commands (navigate, click, type) → all execute in order, HTTP 200 response

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '[{"command":"navigate","options":{"url":"https://example.com"}},{"command":"click","selector":"#btn"},{"command":"type","selector":"#input","options":{"text":"test"}}]'
```

✅ **Test 2**: Send single command in array format → executes successfully (backward compat)

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '[{"command":"navigate","options":{"url":"https://example.com"}}]'
```

✅ **Test 3**: Send empty array → HTTP 400 validation error

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '[]'
# Expected: {"error":"ValidationError","message":"Command array cannot be empty"}
```

✅ **Test 4**: Send array with failing command at index 1 → HTTP 207, partial results with 2 entries (1 success, 1 error)

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '[{"command":"navigate","options":{"url":"https://example.com"}},{"command":"click","selector":"#missing"}]'
# Expected: 207 status, halted=true, completedCount=1, totalCount=2
```

✅ **Test 5**: Send single command (non-array) → backward compatibility maintained, existing API works unchanged

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '{"command":"navigate","options":{"url":"https://example.com"}}'
# Expected: 200 status, same response structure as before (wrapped in new format)
```

**MVP Checkpoint**: 🎯 After completing Phase 2, you have a fully functional MVP that delivers core value

---

## Phase 3: User Story 2 (P2) - Individual Command Timing

**User Story**: API consumers need to understand performance characteristics of each command to identify bottlenecks and debug slow operations.

**Goal**: Add millisecond-precision timing measurements to each command execution result.

**Duration**: 20-30 minutes

**Prerequisites**: User Story 1 complete (Phase 2)

### Tasks

- [ ] T008 [P] [US2] Import performance module from perf_hooks in /Users/Youri/Projects/playwright-server/src/services/command.ts
- [ ] T009 [US2] Add timing measurement around command execution in executeCommandSequence function using performance.now()
- [ ] T010 [US2] Update CommandExecutionResult population to include durationMs field for each command result
- [ ] T011 [US2] Add timing to single command execution for consistency (optional enhancement)

**Independent Test Criteria for US2**:
✅ **Test 1**: Execute command sequence → each result includes durationMs field with positive number

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '[{"command":"navigate","options":{"url":"https://example.com"}},{"command":"click","selector":"#btn"}]'
# Expected: results[0].durationMs > 0, results[1].durationMs > 0
```

✅ **Test 2**: Execute slow command (e.g., waitForSelector with timeout) → timing reflects ~expected duration

```bash
curl -X POST http://localhost:3000/sessions/{id}/command \
  -H "Content-Type: application/json" \
  -d '[{"command":"waitForSelector","selector":"#element","options":{"timeout":2000}}]'
# Expected: durationMs ≈ 2000ms (within margin)
```

✅ **Test 3**: Execute multiple commands → total time ≈ sum of individual durations (overhead <5%)

```bash
# Verify: sum(results[].durationMs) vs total request time
```

---

## Phase 4: User Story 3 (P3) - Session-Scoped Stdout Logging

**User Story**: Operations teams need to troubleshoot failed automation sequences by reviewing session-specific execution logs written to stdout.

**Goal**: Write structured JSON logs to stdout for each command execution with session ID, enabling filtering and debugging.

**Duration**: 20-30 minutes

**Prerequisites**: User Story 1 complete (Phase 2)

### Tasks

- [ ] T012 [P] [US3] Create logger utility with logCommandExecution function in /Users/Youri/Projects/playwright-server/src/utils/logger.ts
- [ ] T013 [US3] Add SessionLogEntry type definition to /Users/Youri/Projects/playwright-server/src/types/command.ts
- [ ] T014 [US3] Integrate logger calls in executeCommandSequence after each command (success and error paths)
- [ ] T015 [US3] Verify log format is valid single-line JSON with all required fields

**Independent Test Criteria for US3**:
✅ **Test 1**: Execute commands → logs appear in stdout with session ID, timestamp, command name, status

```bash
npm run dev 2>&1 | tee server.log &
# Execute commands, then:
cat server.log | grep '"sessionId"'
# Expected: JSON log lines with sessionId, timestamp, command, status fields
```

✅ **Test 2**: Filter logs by session ID → shows only that session's execution history

```bash
cat server.log | jq 'select(.sessionId == "abc-123-def")'
# Expected: All log entries for that session, none from other sessions
```

✅ **Test 3**: Multiple concurrent sessions → logs include session ID prefix, no cross-contamination

```bash
# Create 2 sessions, execute commands in each
cat server.log | jq 'select(.sessionId == "session-1")' | wc -l
cat server.log | jq 'select(.sessionId == "session-2")' | wc -l
# Expected: Correct counts, no mixed logs
```

✅ **Test 4**: Parse logs with jq → valid JSON, all fields accessible

```bash
cat server.log | jq '.command' | sort | uniq -c
# Expected: List of command types with counts
```

---

## Phase 5: Polish & Cross-Cutting Concerns

**Goal**: Final validation, documentation updates, and edge case verification

**Duration**: 15-20 minutes

### Tasks

- [ ] T016 Run full manual test suite covering all acceptance scenarios from spec.md

**Final Validation Checklist**:

- ✅ All user story acceptance scenarios pass
- ✅ Backward compatibility verified (existing single-command API unchanged)
- ✅ TypeScript compilation succeeds with no errors
- ✅ No new dependencies added (constitution compliance)
- ✅ Logs are valid JSON and parseable with jq
- ✅ HTTP status codes correct (200 for success, 207 for partial, 400 for validation errors)

---

## Parallel Execution Opportunities

The following tasks can be executed in parallel as they modify different files or have no dependencies:

### Parallel Set 1 (Phase 1)

- T001 (types) - Independent file modification

### Parallel Set 2 (Phase 3 + Phase 4, after Phase 2 complete)

**US2 and US3 are fully independent and can be developed in parallel:**

- T008, T009, T010, T011 (User Story 2 - Timing) - Modifies services/command.ts
- T012, T013, T014, T015 (User Story 3 - Logging) - Creates new utils/logger.ts, adds logging calls

**Team Strategy**: If you have 2 developers, one can implement US2 while the other implements US3 simultaneously after US1 is complete.

---

## File Modification Summary

| File                                                              | Phase   | Tasks                 | Type   |
| ----------------------------------------------------------------- | ------- | --------------------- | ------ |
| `/Users/Youri/Projects/playwright-server/src/types/command.ts`    | 1, 4    | T001, T013            | Extend |
| `/Users/Youri/Projects/playwright-server/src/services/command.ts` | 2, 3, 4 | T003, T008-T011, T014 | Extend |
| `/Users/Youri/Projects/playwright-server/src/routes/command.ts`   | 2       | T004-T007             | Modify |
| `/Users/Youri/Projects/playwright-server/src/utils/logger.ts`     | 4       | T012                  | New    |

**Total Lines**: ~195 lines of new/modified code
**Files Modified**: 3 existing files
**Files Created**: 1 new file

---

## Success Criteria Mapping

| Success Criterion                                            | Validated By      |
| ------------------------------------------------------------ | ----------------- |
| SC-001: Execute sequence of 10 commands in single request    | Phase 2 Test 1    |
| SC-002: Each result includes millisecond-precision timing    | Phase 3 Test 1    |
| SC-003: Total request time within 5% of sum of command times | Phase 3 Test 3    |
| SC-004: Logs written to stdout in real-time                  | Phase 4 Test 1    |
| SC-005: No performance degradation                           | Phase 3 Test 3    |
| SC-006: 100% backward compatibility                          | Phase 2 Test 5    |
| SC-007: Filter logs by session ID within 30s                 | Phase 4 Test 2, 4 |

---

## Implementation Notes

### Constitution Compliance

- ✅ **Simplicity First**: No new abstractions, straightforward loop logic
- ✅ **TypeScript Foundation**: Full type coverage with strict mode
- ✅ **HTTP-First**: Single endpoint extension, RESTful
- ✅ **Thin Wrapper**: No new Playwright abstractions
- ✅ **No Tests Required**: Manual testing documented in tasks

### Backward Compatibility

- Single command requests continue to work unchanged
- Response format extended (wrapped) but not breaking
- No API versioning needed

### Error Handling

- Validation errors → HTTP 400 before execution
- Execution errors → HTTP 207 with partial results
- Session errors → HTTP 404 (existing behavior)

### Performance Targets

- <5% overhead on total execution time
- <100μs per command for timing/logging
- Linear memory scaling (~100 bytes per command)

---

## Quick Start Commands

```bash
# Checkout feature branch
git checkout 002-sequential-commands

# Install dependencies (if needed)
npm install

# Build and verify types
npm run build

# Run in development mode (watch for logs)
npm run dev

# Test backward compatibility (single command)
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '{"command":"navigate","options":{"url":"https://example.com"}}'

# Test command sequence
curl -X POST http://localhost:3000/sessions/{sessionId}/command \
  -H "Content-Type: application/json" \
  -d '[{"command":"navigate","options":{"url":"https://example.com"}},{"command":"click","selector":"#btn"}]'

# Filter logs by session
npm run dev 2>&1 | grep '"sessionId":"your-session-id"'
```

---

## References

- **Feature Spec**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml)
- **Research Decisions**: [research.md](./research.md)
- **Implementation Guide**: [quickstart.md](./quickstart.md)

---

**Tasks Status**: ✅ Ready for Implementation  
**Next Step**: Begin with Phase 1 (T001) or jump to MVP scope (Phases 1-2)  
**Estimated Completion**: 2-4 hours for full feature, 1-2 hours for MVP
