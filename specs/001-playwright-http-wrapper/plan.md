# Implementation Plan: Playwright HTTP Wrapper

**Branch**: `001-playwright-http-wrapper` | **Date**: 2025-11-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-playwright-http-wrapper/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build an HTTP web server that wraps Playwright (via Patchright) functionality, enabling browser automation via HTTP requests. Users create sessions with TTL and receive unique URLs to execute Playwright commands remotely without local installation.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js LTS (20.x or later)  
**Primary Dependencies**: Patchright (stealth Playwright fork), Express (web framework)  
**Storage**: In-memory session store, filesystem for recordings (WebM)  
**Testing**: Not required per constitution (Principle V)  
**Target Platform**: Node.js server (Linux/macOS/Windows)  
**Project Type**: Single (web server application)  
**Performance Goals**: <5s session creation, <10s command execution, support 5+ concurrent sessions  
**Constraints**: <200ms p95 latency per command, automatic TTL enforcement within 30s, 100% browser cleanup  
**Scale/Scope**: 10 concurrent sessions (default, configurable via env var), RESTful API, session-based isolation

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Principle I: Simplicity First ✅

- **Compliance**: PASS
- **Rationale**: Feature is a thin HTTP wrapper over Patchright with minimal abstractions. Session management uses simple in-memory store. No complex patterns introduced unnecessarily.

### Principle II: TypeScript Foundation ✅

- **Compliance**: PASS
- **Rationale**: Project will be TypeScript with strict mode enabled. Type complexity kept minimal with simple interfaces for Session, Command, Recording entities.

### Principle III: HTTP-First Interface ✅

- **Compliance**: PASS
- **Rationale**: Core design is RESTful HTTP endpoints for all operations. JSON payloads for commands. Intuitive URL structure (session URLs, stop URLs, playback URLs).

### Principle IV: Thin Playwright Wrapper ✅

- **Compliance**: PASS
- **Rationale**: Commands map directly to Patchright/Playwright methods via direct method mapping format: `{"command": "click", "selector": "#button", "options": {}}`. No custom abstractions over Playwright API.

### Principle V: No Testing Requirements ✅

- **Compliance**: PASS
- **Rationale**: No tests required per constitution. Specification includes user scenarios for manual validation. TypeScript strict mode provides compile-time safety.

### Overall Assessment: ✅ PASS

All constitutional principles are satisfied. No violations requiring justification. Ready to proceed to Phase 0 research.

---

## Post-Design Constitution Re-evaluation

_Phase 1 design complete. Re-evaluating constitution compliance._

### Principle I: Simplicity First ✅

- **Compliance**: PASS (Confirmed)
- **Design Review**:
  - Express framework chosen (minimal dependencies, simple API)
  - Command-Strategy pattern with Map-based session store
  - Per-session setTimeout timers for TTL management
  - Native Playwright video recording (no transcoding)
  - Direct method mapping for commands (no abstraction layers)
  - All decisions prioritize simplicity over theoretical perfection

### Principle II: TypeScript Foundation ✅

- **Compliance**: PASS (Confirmed)
- **Design Review**:
  - Data model uses simple interfaces: Session, Command, RecordingMetadata, CommandError
  - No advanced generic constructs or complex type transformations
  - Type definitions align with runtime data structures (Map<string, SessionData>)
  - TypeScript strict mode will catch edge cases at compile time

### Principle III: HTTP-First Interface ✅

- **Compliance**: PASS (Confirmed)
- **Design Review**:
  - RESTful API with intuitive endpoints: POST /sessions, POST /sessions/:id/command, DELETE /sessions/:id
  - JSON payloads for all requests and responses
  - Proper HTTP status codes (201 for creation, 404 for not found, 408 for timeout, etc.)
  - Human-readable error messages in all error responses

### Principle IV: Thin Playwright Wrapper ✅

- **Compliance**: PASS (Confirmed)
- **Design Review**:
  - Direct mapping of HTTP commands to Playwright methods via CommandRegistry
  - No custom abstractions or "improved" Playwright concepts
  - Browser context per session preserves Patchright's architecture
  - Users can reference Playwright documentation directly for command usage

### Principle V: No Testing Requirements ✅

- **Compliance**: PASS (Confirmed)
- **Design Review**:
  - No test files in project structure
  - Manual validation via user scenarios in specification
  - TypeScript strict mode provides compile-time safety
  - QuickStart guide enables manual testing of all endpoints

### Final Assessment: ✅ ALL GATES PASSED

Design phase complete. All constitutional principles satisfied. No violations. No complexity justifications required. Ready for Phase 2 (implementation tasks breakdown).

## Project Structure

### Documentation (this feature)

```text
specs/001-playwright-http-wrapper/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── types/              # TypeScript type definitions (Session, Command, Recording)
├── services/           # Core business logic
│   ├── session.ts      # Session lifecycle management (create, terminate, cleanup)
│   ├── browser.ts      # Patchright/Playwright interaction wrapper
│   ├── recording.ts    # Video recording management (start, stop, cleanup)
│   └── command.ts      # Command execution and result handling
├── routes/             # HTTP endpoint handlers
│   ├── session.ts      # POST /sessions, DELETE /sessions/:id
│   ├── command.ts      # POST /sessions/:id/command
│   └── recording.ts    # GET /recordings/:id (playback URL)
├── middleware/         # Express/Fastify middleware
│   ├── error.ts        # Error handling and HTTP status mapping
│   └── validation.ts   # Request payload validation
├── utils/              # Utilities
│   ├── ttl.ts          # TTL tracking and expiration
│   └── cleanup.ts      # Resource cleanup helpers
└── server.ts           # Main server entry point

recordings/             # Filesystem storage for session recordings (gitignored)

package.json            # Node.js dependencies and scripts
tsconfig.json           # TypeScript strict configuration
.env.example            # Environment variable template
```

**Structure Decision**: Single project structure (Option 1 from template) adapted for Node.js web server. This aligns with Constitution Principle I (Simplicity First) - a single TypeScript project with clear separation of concerns: types, services (business logic), routes (HTTP handlers), middleware, and utilities. No complex multi-project setup needed for this thin wrapper service.

## Complexity Tracking

No violations of constitution principles. This section is not applicable.
