# Implementation Tasks: Playwright HTTP Wrapper

**Feature Branch**: `001-playwright-http-wrapper`  
**Date**: 2025-11-19  
**Status**: Ready for Implementation

This document breaks down the implementation into executable tasks organized by user story priority.

---

## Overview

**Total Estimated Tasks**: 47  
**Organization**: Tasks are grouped by user story to enable independent, incremental delivery  
**Tests**: Not required per constitution (Principle V - No Testing Requirements)

### Task Distribution by Phase

| Phase | User Story | Task Count | Status |
|-------|------------|------------|--------|
| Phase 1 | Setup | 6 | Pending |
| Phase 2 | Foundational | 8 | Pending |
| Phase 3 | US1 - Start Browser Session (P1) | 10 | Pending |
| Phase 4 | US2 - Execute Playwright Commands (P2) | 10 | Pending |
| Phase 5 | US3 - Record and Replay Sessions (P3) | 6 | Pending |
| Phase 6 | US4 - Manage Multiple Concurrent Sessions (P4) | 4 | Pending |
| Phase 7 | Polish & Cross-Cutting | 3 | Pending |

---

## Phase 1: Setup & Project Initialization

**Goal**: Bootstrap the TypeScript Node.js project with all required dependencies and configuration.

**Tasks**:

- [X] T001 Initialize Node.js project with package.json in repository root
- [X] T002 [P] Install dependencies: patchright, express, and uuid packages via npm
- [X] T003 [P] Install TypeScript and dev dependencies: @types/node, @types/express, typescript, ts-node
- [X] T004 [P] Create tsconfig.json with strict mode enabled in repository root
- [X] T005 [P] Create .gitignore file (node_modules, dist, recordings, .env) in repository root
- [X] T006 [P] Create .env.example with MAX_CONCURRENT_SESSIONS=10, PORT=3000 in repository root

**Completion Criteria**:
- `npm install` runs without errors
- TypeScript compiles successfully with strict mode
- Project structure matches plan.md specification

**Parallel Execution**: Tasks T002-T006 can run in parallel after T001 completes

---

## Phase 2: Foundational Components

**Goal**: Implement core types, utilities, and middleware that all user stories depend on.

**Blocking Prerequisites**: All Phase 1 tasks must be complete before starting Phase 2.

**Tasks**:

- [X] T007 [P] Define SessionData interface in src/types/session.ts with id, ttl, createdAt, lastActivityAt, expiresAt, browserContext, timeoutHandle, recordingMetadata fields
- [X] T008 [P] Define RecordingMetadata interface in src/types/recording.ts with enabled, playbackUrl, filePath, startedAt, size fields
- [X] T009 [P] Define CommandRequest interface in src/types/command.ts with command, selector, options fields
- [X] T010 [P] Define CommandResponse interface in src/types/command.ts with result, executedAt fields
- [X] T011 [P] Define CommandError interface in src/types/errors.ts with type, message, details fields
- [X] T012 [P] Define custom error classes (SessionNotFoundError, CommandNotFoundError, ValidationError, TimeoutError, ElementNotFoundError, ExecutionError, MaxSessionsReachedError) in src/types/errors.ts
- [X] T013 Implement error handling middleware in src/middleware/error.ts that maps error types to HTTP status codes and formats error responses
- [X] T014 Create Express app initialization in src/server.ts with JSON middleware, error handler, and server startup logic

**Completion Criteria**:
- All TypeScript types compile without errors
- Error middleware correctly maps custom errors to HTTP status codes
- Express server starts and listens on configured PORT

**Parallel Execution**: Tasks T007-T012 can all run in parallel (different files, no dependencies)

---

## Phase 3: User Story 1 - Start Browser Session (P1 - MVP)

**Goal**: Enable users to create and terminate browser automation sessions via HTTP.

**Story Context**: This is the foundational MVP capability. Users can create sessions with TTL, receive unique URLs, and manually terminate sessions.

**Independent Test Criteria**:
- Can send POST /sessions request with TTL and receive 201 response with sessionId, sessionUrl, stopUrl, expiresAt, createdAt
- Can send POST /sessions with recording:true and also receive playbackUrl
- Can send DELETE /sessions/:id and verify session terminates (subsequent commands return 404)
- Session automatically terminates after TTL expires (verify with sleep + command attempt)
- Can verify browser process cleanup after session termination

**Blocking Prerequisites**: Phase 2 must be complete (types, error middleware, Express app).

**Tasks**:

- [X] T015 [US1] Initialize Patchright browser singleton in src/services/browser.ts with chromium.launch({ headless: true })
- [X] T016 [US1] Implement in-memory session store (Map<string, SessionData>) in src/services/session.ts
- [X] T017 [US1] Implement createSession function in src/services/session.ts that generates UUID, creates browser context, initializes page, sets up TTL timer, stores session in Map, returns SessionData
- [X] T018 [US1] Implement cleanupSession function in src/services/session.ts that clears timeout, closes browser context, removes from Map
- [X] T019 [US1] Implement TTL timer setup in src/utils/ttl.ts that schedules cleanupSession via setTimeout
- [X] T020 [US1] Implement resetSessionTTL function in src/utils/ttl.ts that clears old timer, updates timestamps, creates new timeout
- [X] T021 [US1] Implement POST /sessions endpoint in src/routes/session.ts that validates TTL (60000-14400000ms), calls createSession, returns 201 with session URLs
- [X] T022 [US1] Implement DELETE /sessions/:id endpoint in src/routes/session.ts that calls cleanupSession and returns 200
- [X] T023 [US1] Add session limit enforcement in createSession that checks Map.size against MAX_CONCURRENT_SESSIONS env var, throws MaxSessionsReachedError if exceeded
- [X] T024 [US1] Register session routes in src/server.ts with app.use('/sessions', sessionRouter)

**Completion Criteria** (US1 Acceptance Scenarios):
1. POST /sessions with 30-min TTL returns unique session URL and stop URL
2. POST /sessions with recording:true returns session URL, stop URL, and playback URL
3. Session is active and ready (can be verified in next user story)
4. Session with 5-min TTL auto-terminates after 5 minutes
5. DELETE stop URL immediately terminates session and releases resources

**Parallel Execution**:
- T015-T016 can run in parallel (different files)
- T019-T020 can run in parallel with T017-T018 (different files)
- T021-T022 depend on T017-T020 completing

---

## Phase 4: User Story 2 - Execute Playwright Commands (P2)

**Goal**: Enable users to execute Playwright commands on active sessions and receive results.

**Story Context**: Core automation capability. Users send JSON commands to session URL and receive execution results.

**Independent Test Criteria**:
- Create session (US1), send navigate command, verify browser navigates (can check via screenshot or textContent)
- Send click command with selector, verify click occurs (page changes or element state changes)
- Send textContent command with selector, receive extracted text in response
- Send multiple commands in sequence, verify each executes on same browser context
- Send command with invalid parameters, receive 400 ValidationError with clear message
- Send command to non-existent session, receive 404 SessionNotFoundError
- Verify TTL resets after each successful command

**Blocking Prerequisites**: Phase 3 (US1) must be complete - sessions must be created before commands can execute.

**Tasks**:

- [X] T025 [US2] Define CommandRegistry type in src/services/command.ts as Record<string, CommandHandler> where CommandHandler is (page, params) => Promise<any>
- [X] T026 [P] [US2] Implement navigate command handler in src/services/command.ts that calls page.goto with options.url and options.waitUntil
- [X] T027 [P] [US2] Implement click command handler in src/services/command.ts that calls page.locator(selector).click with options
- [X] T028 [P] [US2] Implement type/fill command handler in src/services/command.ts that calls page.locator(selector).fill with options.text
- [X] T029 [P] [US2] Implement textContent command handler in src/services/command.ts that calls page.locator(selector).textContent and returns result
- [X] T030 [P] [US2] Implement screenshot command handler in src/services/command.ts that calls page.screenshot with options, returns base64 encoded buffer
- [X] T031 [P] [US2] Implement additional command handlers in src/services/command.ts: getAttribute, press, waitForSelector, evaluate
- [X] T032 [US2] Implement executeCommand function in src/services/command.ts that validates command exists, retrieves session, gets page, executes handler, catches errors, resets TTL on success
- [X] T033 [US2] Implement request validation middleware in src/middleware/validation.ts that validates CommandRequest schema (command required, selector required for element commands)
- [X] T034 [US2] Implement POST /sessions/:id/command endpoint in src/routes/command.ts that validates request, calls executeCommand, returns CommandResponse with result and executedAt
- [X] T035 [US2] Register command routes in src/server.ts with app.use('/sessions', commandRouter)

**Completion Criteria** (US2 Acceptance Scenarios):
1. Navigate command successfully navigates browser to URL
2. Click command successfully clicks element by selector
3. TextContent command returns extracted text
4. Multiple commands execute in sequence on same browser context
5. Invalid command parameters return 400 with clear error message

**Parallel Execution**:
- T026-T031 can all run in parallel (independent command handlers in same file, different functions)
- T033 can run in parallel with T025-T032
- T034 depends on T025-T033 completing

---

## Phase 5: User Story 3 - Record and Replay Sessions (P3)

**Goal**: Enable optional video recording of sessions with playback URL access.

**Story Context**: Debugging and documentation feature. Users can enable recording at session creation and access video after session ends.

**Independent Test Criteria**:
- Create session with recording:true, receive playbackUrl in response
- Execute several commands (from US2), stop session, verify video file exists on filesystem
- Access playback URL via GET request, receive video/webm content
- Create session with recording:false, verify no playback URL in response and no video file created
- Wait 1 hour after session termination, verify playback URL returns 404 and file is deleted

**Blocking Prerequisites**: Phase 3 (US1) complete for session creation. Phase 4 (US2) complete for command execution (to have something to record).

**Tasks**:

- [X] T036 [US3] Add recordVideo configuration in createSession (src/services/session.ts) that creates recordings/<sessionId> directory and configures browser context with recordVideo option when recording:true
- [X] T037 [US3] Generate playbackUrl in createSession (src/services/session.ts) as /recordings/<sessionId>/video.webm when recording enabled, add to RecordingMetadata
- [X] T038 [US3] Implement recording cleanup scheduler in src/services/recording.ts with setInterval (every 15 min) that scans recordings directory, deletes directories where session ended >1 hour ago
- [X] T039 [US3] Create recordings/ directory structure on server startup in src/server.ts using fs.mkdir with recursive:true
- [X] T040 [US3] Implement GET /recordings/:sessionId/video.webm endpoint using express.static middleware in src/routes/recording.ts with proper video/webm Content-Type header
- [X] T041 [US3] Register recording routes and static middleware in src/server.ts with app.use('/recordings', express.static('recordings'))

**Completion Criteria** (US3 Acceptance Scenarios):
1. POST /sessions with recording:true returns session URL, stop URL, playback URL
2. Commands executed during recorded session are captured in video file
3. Playback URL serves viewable WebM video file after session ends
4. Session without recording has no playback URL and no recording overhead
5. Recording finalized when session terminates, playback URL remains accessible

**Parallel Execution**:
- T036-T037 modify existing createSession function (must be sequential within that function)
- T038-T039 can run in parallel with each other and with T040-T041

---

## Phase 6: User Story 4 - Manage Multiple Concurrent Sessions (P4)

**Goal**: Support multiple simultaneous browser sessions with isolation and configurable limits.

**Story Context**: Scalability enhancement. Users can run parallel automation tasks on same server.

**Independent Test Criteria**:
- Create 5 sessions simultaneously (parallel requests), verify each receives unique URLs
- Execute commands on session 1, verify session 2-5 are unaffected (independent browser contexts)
- Let one session TTL expire, verify only that session terminates, others remain active
- Create sessions until limit reached (10), verify 11th request returns 503 MaxSessionsReached error
- Verify sessions have independent cookies, storage, and navigation state

**Blocking Prerequisites**: Phase 3 (US1) must be complete. US4 builds on session creation logic but is independent of US2 and US3.

**Tasks**:

- [X] T042 [P] [US4] Add MAX_CONCURRENT_SESSIONS validation in createSession (src/services/session.ts) - already implemented in T023, verify it works correctly
- [X] T043 [P] [US4] Verify session isolation in browser context creation (src/services/browser.ts) - each newContext call provides isolated cookies, storage, authentication
- [X] T044 [US4] Add session listing endpoint GET /sessions in src/routes/session.ts that returns array of active session IDs with remaining TTL (optional, useful for testing)
- [X] T045 [US4] Document concurrent session behavior and limits in README.md (create if doesn't exist) with examples of parallel usage

**Completion Criteria** (US4 Acceptance Scenarios):
1. 5 simultaneous session creation requests all succeed with unique URLs
2. Commands on one session don't affect others
3. One session expiring doesn't terminate others
4. Session status query shows all active sessions with TTL

**Parallel Execution**:
- T042-T043 can run in parallel (different concerns)
- T044 can run in parallel with T045

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Final refinements for production readiness and documentation.

**Blocking Prerequisites**: All user story phases complete.

**Tasks**:

- [X] T046 [P] Add comprehensive error messages for all error types in src/middleware/error.ts with user-friendly descriptions
- [X] T047 [P] Add environment variable validation on server startup in src/server.ts (PORT, MAX_CONCURRENT_SESSIONS with sensible defaults)
- [X] T048 [P] Create README.md in repository root with quick start guide, API documentation reference to quickstart.md, and deployment instructions

**Completion Criteria**:
- All error responses include clear, actionable messages
- Server starts with default config if env vars not provided
- README provides clear onboarding for new users

**Parallel Execution**: All tasks (T046-T048) can run in parallel

---

## Dependency Graph

### Story-Level Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1 - Session Management) ← MVP BOUNDARY
    ↓
    ├──→ Phase 4 (US2 - Command Execution)
    ├──→ Phase 6 (US4 - Multiple Sessions)
    └──→ Phase 5 (US3 - Recording) → depends on US2 for commands to record
         ↓
Phase 7 (Polish)
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7

**Independent Paths**:
- US4 (Phase 6) can be implemented in parallel with US2/US3 after US1 completes
- US3 (Phase 5) requires US2 for meaningful recordings, but recording infrastructure can be built earlier

---

## Implementation Strategy

### Minimum Viable Product (MVP)

**Scope**: Phase 1 + Phase 2 + Phase 3 (US1 only)

**Deliverable**: Users can create browser sessions via HTTP, receive unique URLs, and terminate sessions. Browser processes are properly managed with TTL and cleanup.

**Validation**: 
- POST /sessions returns session URLs
- DELETE /sessions/:id terminates session
- TTL auto-termination works
- Browser cleanup verified

**Time Estimate**: ~4-6 hours for experienced developer

---

### Incremental Delivery Plan

**Sprint 1 (MVP)**: Phases 1-3  
→ Deliverable: Session management working  
→ User can create/stop sessions, TTL works

**Sprint 2**: Phase 4 (US2)  
→ Deliverable: Command execution working  
→ User can automate browsers via HTTP commands

**Sprint 3**: Phase 5 (US3)  
→ Deliverable: Recording & playback working  
→ User can debug with video recordings

**Sprint 4**: Phase 6 (US4) + Phase 7  
→ Deliverable: Multiple sessions + polish  
→ Production-ready system

---

## Parallel Execution Opportunities

### Within Phase 2 (Foundational)
Can be executed simultaneously:
- T007-T012: All type definitions (6 parallel tasks)
- T013-T014: Middleware and server setup (2 parallel tasks after types)

### Within Phase 3 (US1)
Can be executed simultaneously:
- T015-T016: Browser init and session store
- T019-T020: TTL utilities (while session service is being built)

### Within Phase 4 (US2)
Can be executed simultaneously:
- T026-T031: All command handlers (6 parallel tasks)

### Within Phase 5 (US3)
Can be executed simultaneously:
- T038-T039: Recording cleanup and directory setup
- T040-T041: Recording routes and static serving

### Within Phase 6 (US4)
Can be executed simultaneously:
- T042-T043: Session limits and isolation verification
- T044-T045: Listing endpoint and documentation

### Within Phase 7 (Polish)
Can be executed simultaneously:
- T046-T048: All polish tasks (3 parallel tasks)

**Total Parallelizable Tasks**: 26 out of 48 tasks (54%) marked with [P]

---

## Validation Checklist

After completing all tasks, verify:

### US1 - Start Browser Session
- [ ] POST /sessions with TTL returns session URLs within 5 seconds
- [ ] Session auto-terminates within 30 seconds of TTL expiration
- [ ] DELETE /sessions/:id immediately terminates session
- [ ] Browser processes cleaned up (verify with process monitoring)
- [ ] Recording enabled sessions include playbackUrl

### US2 - Execute Playwright Commands  
- [ ] Navigate command works (can verify with screenshot)
- [ ] Click command works (element interactions succeed)
- [ ] TextContent extraction returns correct data
- [ ] Sequential commands execute on same browser context
- [ ] Invalid commands return 400 with clear error message
- [ ] Commands to non-existent sessions return 404
- [ ] TTL resets after each successful command

### US3 - Record and Replay Sessions
- [ ] Recording enabled sessions create video files
- [ ] Playback URL serves video/webm content
- [ ] Non-recorded sessions have zero overhead
- [ ] Recordings accessible for 1 hour after session end
- [ ] Recordings auto-delete after 1 hour retention

### US4 - Manage Multiple Concurrent Sessions
- [ ] 5+ parallel sessions all operate independently
- [ ] Session limit enforced (11th session returns 503)
- [ ] One session expiring doesn't affect others
- [ ] Sessions have isolated cookies and storage

### Cross-Cutting Concerns
- [ ] All errors return human-readable messages
- [ ] Server starts with default config
- [ ] README provides clear quick start guide
- [ ] TypeScript compiles with no errors in strict mode

---

## Notes

**Constitution Compliance**: This task breakdown follows Principle V (No Testing Requirements). All validation is manual via acceptance scenarios defined in spec.md.

**File Path Clarity**: Every task specifies exact file path to enable autonomous LLM execution.

**Incremental Value**: Each phase delivers working, testable functionality that builds on previous phases.

**Session Management**: The core innovation is the Map-based session store with per-session setTimeout timers, enabling simple TTL management without external dependencies.

**Command Registry**: Strategy pattern for command handlers enables easy extension while maintaining thin Playwright wrapper principle.

---

**Last Updated**: 2025-11-19  
**Total Tasks**: 48  
**Parallelizable**: 26 (54%)  
**MVP Tasks**: 20 (Phase 1-3)  
**Full Feature**: 48 tasks across all 7 phases
