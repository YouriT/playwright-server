# Tasks: Proxy Configuration Support

**Feature Branch**: `003-proxy-support`
**Input**: Design documents from `/specs/003-proxy-support/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/openapi.yaml ✅

**Tests**: Not required per Constitution Principle V (No Testing Requirements)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **Checkbox**: Always `- [ ]` (markdown checkbox format)
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create type definitions and utilities needed by all user stories

- [ ] T001 [P] Create ProxyConfig and ProxyProtocol type definitions in src/types/proxy.ts
- [ ] T002 [P] Add ProxyValidationError to src/types/errors.ts
- [ ] T003 [P] Extend SessionData interface with optional proxyConfig field in src/types/session.ts
- [ ] T004 [P] Create proxy URL parsing function supporting http/https/socks5 protocols, URL-encoded credentials, default ports (80/443/1080), and bypass field extraction in src/services/proxy.ts
- [ ] T005 [P] Create proxy validation function enforcing protocol enum (http/https/socks5), port range 1-65535, hostname presence, authentication completeness (both or neither), and optional bypass format in src/services/proxy.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core proxy infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement credential redaction in Pino logger configuration in src/utils/logger.ts
- [ ] T007 Add custom censor function for proxy credentials in src/utils/logger.ts
- [ ] T008 Add proxy redaction paths to logger configuration in src/utils/logger.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure Global Proxy via Environment Variable (Priority: P1) 🎯 MVP

**Goal**: Enable system administrators to set a default proxy for all sessions via environment variables at server startup

**Independent Test**: Set HTTP_PROXY environment variable, start server, create session without proxy config, verify browser traffic routes through global proxy (test with httpbin.org/ip)

**Acceptance**:

- Server validates proxy config at startup
- Server logs confirmation of global proxy (credentials redacted)
- Sessions automatically use global proxy
- Invalid config fails server startup with clear error
- No proxy env vars = direct connection

### Implementation for User Story 1

- [ ] T009 [US1] Create getGlobalProxyConfig function to read HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars in src/services/proxy.ts
- [ ] T010 [US1] Add proxy validation and error handling to getGlobalProxyConfig function in src/services/proxy.ts
- [ ] T011 [US1] Load and validate global proxy configuration at server startup in src/server.ts
- [ ] T012 [US1] Add global proxy logging with credential redaction in src/server.ts
- [ ] T013 [US1] Modify session creation to use global proxy as default in src/services/session.ts
- [ ] T014 [US1] Pass proxy config to Playwright BrowserContext.newContext in src/services/session.ts
- [ ] T015 [US1] Add error handling for invalid global proxy configuration in src/server.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - global proxy works for all sessions

---

## Phase 4: User Story 2 - Configure Per-Session Proxy (Priority: P2)

**Goal**: Enable API consumers to specify different proxies for individual sessions, overriding global defaults

**Independent Test**: Create multiple sessions with different proxy configs (US proxy, EU proxy, no proxy), verify each session uses its specified proxy independently via httpbin.org/ip

**Acceptance**:

- Session creation accepts optional proxy in request body
- Session-specific proxy overrides global proxy
- Multiple sessions maintain independent proxy configs
- Sessions without proxy use global default (or direct if no global)
- Invalid proxy config fails session creation with clear error

### Implementation for User Story 2

- [ ] T016 [US2] Extend CreateSessionOptions interface with optional proxy field in src/types/session.ts
- [ ] T017 [US2] Add proxy parameter validation to session creation route in src/routes/session.ts
- [ ] T018 [US2] Parse proxy configuration from request body in src/routes/session.ts
- [ ] T019 [US2] Validate per-session proxy configuration before session creation in src/routes/session.ts
- [ ] T020 [US2] Implement proxy priority logic (session-specific > global > none) in src/services/session.ts
- [ ] T021 [US2] Pass session-specific proxy to BrowserContext.newContext in src/services/session.ts
- [ ] T022 [US2] Add error responses for invalid proxy configuration (400 errors) in src/routes/session.ts
- [ ] T023 [US2] Add logging for per-session proxy usage with credential redaction in src/services/session.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - global proxy OR per-session proxy

---

## Phase 5: User Story 3 - Support Authenticated Proxies (Priority: P2)

**Goal**: Enable authentication with commercial proxy services requiring username and password credentials

**Independent Test**: Configure proxy with authentication (both globally and per-session), verify successful authentication with proxy server, test with/without credentials, verify authentication failure messages

**Acceptance**:

- Global proxy with username/password authenticates successfully
- Session proxy with username/password authenticates successfully
- Missing credentials when required causes auth errors
- Incorrect credentials show clear auth failure message
- Credentials are redacted in all logs

### Implementation for User Story 3

- [ ] T024 [US3] Add username and password fields to ProxyConfig type in src/types/proxy.ts
- [ ] T025 [US3] Implement authentication completeness validation (both or neither) in src/services/proxy.ts
- [ ] T026 [US3] Parse credentials from proxy URL format (protocol://user:pass@host:port) in src/services/proxy.ts
- [ ] T027 [US3] Support separate username/password fields in API request in src/routes/session.ts
- [ ] T028 [US3] Pass username and password to Playwright proxy configuration in src/services/session.ts
- [ ] T029 [US3] Add credential validation error messages in src/services/proxy.ts
- [ ] T030 [US3] Verify credential redaction in logs for authenticated proxies in src/utils/logger.ts
- [ ] T031 [US3] Handle proxy authentication failures with clear error messages in src/services/session.ts

**Checkpoint**: All user stories should now be independently functional - full proxy support with authentication

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, documentation, and validation

- [ ] T032 [P] Add ProxyConfig schema to OpenAPI specification in specs/003-proxy-support/contracts/openapi.yaml (verification only - already complete)
- [ ] T033 [P] Update README.md with proxy configuration examples
- [ ] T034 [P] Add proxy configuration section to environment variable documentation
- [ ] T035 Validate quickstart.md examples with manual testing
- [ ] T036 Test global proxy with Bright Data (or similar service)
- [ ] T037 Test per-session proxy with multiple proxy providers
- [ ] T038 Test SOCKS5 proxy configuration
- [ ] T039 Verify credential redaction in all log scenarios
- [ ] T040 Test Docker deployment with proxy environment variables
- [ ] T041 Update AGENTS.md via update-agent-context.sh script

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1 - Global Proxy)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2 - Per-Session Proxy)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable
- **User Story 3 (P2 - Authenticated Proxies)**: Can start after Foundational (Phase 2) - Extends US1 and US2 but independently testable

### Within Each User Story

- Models/types before services
- Services before routes
- Core implementation before error handling and logging
- Story complete and tested before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks can run in parallel

```bash
# Launch all setup tasks together:
# T001: Create ProxyConfig types
# T002: Add ProxyValidationError
# T003: Extend SessionData
# T004: Create proxy URL parsing
# T005: Create proxy validation
```

**Phase 2 (Foundational)**: Tasks must run sequentially (all modify src/utils/logger.ts)

**User Stories**: Once Phase 2 completes, user stories can start in parallel:

```bash
# If team capacity allows:
# Developer A: User Story 1 (T009-T015)
# Developer B: User Story 2 (T016-T023)
# Developer C: User Story 3 (T024-T031)
```

**Phase 6 (Polish)**: Most tasks can run in parallel

```bash
# Documentation tasks (T032-T034): parallel
# Testing tasks (T035-T040): can run in parallel after implementation complete
```

---

## Parallel Example: Setup Phase

```bash
# All Setup tasks can launch simultaneously (different files):
Task: "Create ProxyConfig and ProxyProtocol type definitions in src/types/proxy.ts"
Task: "Add ProxyValidationError to src/types/errors.ts"
Task: "Extend SessionData interface in src/types/session.ts"
Task: "Create proxy URL parsing function in src/services/proxy.ts"
Task: "Create proxy validation function in src/services/proxy.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T008) - CRITICAL
3. Complete Phase 3: User Story 1 (T009-T015)
4. **STOP and VALIDATE**: Test global proxy independently
   - Set HTTP_PROXY environment variable
   - Start server, verify logs show proxy config (credentials redacted)
   - Create session, navigate to httpbin.org/ip
   - Verify IP matches proxy IP
5. Deploy/demo if ready

**MVP Delivers**: Basic proxy support via environment variables - covers most common use case

### Incremental Delivery

1. **Foundation** (Phases 1-2) → Core types and logging ready
2. **+ User Story 1** → Global proxy working → Deploy/Demo (MVP!)
3. **+ User Story 2** → Per-session proxy working → Deploy/Demo (Advanced use cases)
4. **+ User Story 3** → Authenticated proxies working → Deploy/Demo (Production-ready)
5. **+ Polish** → Documentation and validation complete → Full release

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Phases 1-2)
2. Once Foundational is done:
   - Developer A: User Story 1 (Global proxy)
   - Developer B: User Story 2 (Per-session proxy)
   - Developer C: User Story 3 (Authentication)
3. Stories integrate independently without conflicts

---

## Task Summary

- **Total Tasks**: 41
- **Setup Phase**: 5 tasks
- **Foundational Phase**: 3 tasks (BLOCKING)
- **User Story 1 (P1)**: 7 tasks (MVP)
- **User Story 2 (P2)**: 8 tasks
- **User Story 3 (P2)**: 8 tasks
- **Polish Phase**: 10 tasks

### Tasks per User Story

- **US1 (Global Proxy)**: 7 implementation tasks
- **US2 (Per-Session Proxy)**: 8 implementation tasks
- **US3 (Authenticated Proxies)**: 8 implementation tasks

### Parallel Opportunities

- **Phase 1**: 5 tasks can run in parallel (different files)
- **Phase 2**: Sequential (same file modifications)
- **User Stories**: 3 stories can run in parallel after Phase 2
- **Phase 6**: ~7 tasks can run in parallel (documentation and testing)

### Suggested MVP Scope

**Minimum Viable Product**: User Story 1 only (T001-T015)

- Covers 80% use case: global proxy for all sessions
- 15 tasks total (Setup + Foundational + US1)
- Can be completed and validated independently
- Provides immediate value

---

## Notes

- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
- [P] marker indicates parallelizable tasks (different files, no dependencies)
- [Story] label maps tasks to user stories (US1, US2, US3) for traceability
- No test tasks included per Constitution Principle V (manual testing only)
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, blocking dependencies between user stories
