# Implementation Plan: Proxy Configuration Support

**Branch**: `003-proxy-support` | **Date**: 2025-11-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-proxy-support/spec.md`

## Summary

Add proxy configuration support to the playwright-server, enabling users to route browser traffic through proxy servers (like Bright Data) either globally via environment variables or per-session via API request. This feature supports HTTP, HTTPS, and SOCKS5 protocols with authentication, allowing flexible proxy usage for different automation scenarios (multi-region testing, IP rotation, corporate proxies).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode enabled)  
**Primary Dependencies**: Express 5.1.0, Patchright 1.56.1, uuid 13.0.0, pino 10.1.0  
**Storage**: In-memory session store (no changes required)  
**Testing**: Not required (per Constitution Principle V)  
**Target Platform**: Node.js LTS (20.x or later)  
**Project Type**: Single project (backend HTTP server)  
**Performance Goals**: Proxy configuration validation under 10ms, no additional overhead beyond proxy latency  
**Constraints**: Use Node.js built-in URL class for parsing proxy URLs; Pino redact config for credential masking  
**Scale/Scope**: Support for unlimited proxy configurations per session, global default proxy shared across all sessions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### ✅ Principle I: Simplicity First

- **Status**: PASS
- **Rationale**: Proxy configuration adds a single optional parameter to session creation and one global configuration at startup. This is a straightforward extension of existing session management without introducing new abstractions or patterns.

### ✅ Principle II: TypeScript Foundation

- **Status**: PASS
- **Rationale**: All proxy configuration will be typed with TypeScript interfaces (ProxyConfig, ProxyProtocol). Strict mode is already enabled in the project.

### ✅ Principle III: HTTP-First Interface

- **Status**: PASS
- **Rationale**: Proxy configuration is exposed via existing HTTP endpoints: environment variables at startup (no API changes) and optional JSON field in session creation request. No new endpoints required.

### ✅ Principle IV: Thin Playwright Wrapper

- **Status**: PASS
- **Rationale**: Playwright/Patchright BrowserContext already supports proxy configuration natively via `launchOptions.proxy`. This feature maps HTTP input directly to Playwright's proxy API without creating abstractions.

### ✅ Principle V: No Testing Requirements

- **Status**: PASS
- **Rationale**: No tests will be written. Validation relies on TypeScript types and manual testing with actual proxy services.

### ✅ Principle VI: Structured Logging & Observability

- **Status**: PASS
- **Rationale**: Proxy configuration will be logged at startup (global) and session creation (per-session) with credentials automatically redacted. Existing Pino logger will be extended to mask proxy passwords/usernames in all log output.

### Summary

All constitutional principles are satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-proxy-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── openapi.yaml     # Extended session creation endpoint with proxy config
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── types/
│   ├── session.ts       # [MODIFY] Add optional proxyConfig field
│   ├── proxy.ts         # [NEW] ProxyConfig, ProxyProtocol types
│   └── errors.ts        # [MODIFY] Add ProxyValidationError
├── services/
│   ├── session.ts       # [MODIFY] Pass proxy config to browser context
│   ├── proxy.ts         # [NEW] Parse, validate, redact proxy configs
│   └── browser.ts       # [NO CHANGE] Uses existing browser singleton
├── routes/
│   └── session.ts       # [MODIFY] Accept optional proxy config in POST body
├── utils/
│   └── logger.ts        # [MODIFY] Add proxy credential redaction to log serializer
└── server.ts            # [MODIFY] Load and validate global proxy from env vars
```

**Structure Decision**: Single project structure maintained. Proxy functionality integrates into existing session management with minimal new files (types/proxy.ts, services/proxy.ts). This aligns with the project's simplicity principle.

## Complexity Tracking

> No constitution violations detected. This section is not applicable.

## Phase 0: Outline & Research

### Research Tasks

1. **Playwright Proxy Configuration API**
   - Task: Research Patchright/Playwright BrowserContext proxy configuration options
   - Questions:
     - What is the exact TypeScript interface for `launchOptions.proxy`?
     - Does Playwright support SOCKS5 directly or only HTTP/HTTPS?
     - How does Playwright handle proxy authentication (username/password)?
     - What happens when proxy connection fails - does context creation fail or navigation fail?

2. **Proxy URL Parsing**
   - Task: Research standard proxy URL format parsing in Node.js
   - Questions:
     - Should we use Node.js built-in `URL` class for parsing proxy URLs?
     - How to handle edge cases (missing port, invalid protocol, special characters in passwords)?
     - What libraries exist for proxy URL parsing (if any)?

3. **Credential Redaction in Pino**
   - Task: Research Pino log serializer patterns for masking sensitive data
   - Questions:
     - How to implement custom redaction rules in Pino?
     - Should credentials be redacted at log time or when creating log context?
     - How to handle nested objects containing credentials?

4. **Environment Variable Naming Convention**
   - Task: Research standard proxy environment variable names
   - Questions:
     - Should we use standard `HTTP_PROXY`, `HTTPS_PROXY` names or custom names?
     - How do these interact with Node.js/Playwright's built-in proxy env var handling?
     - Should we support separate env vars for server/port/username/password or single URL?

### Output

All findings will be consolidated in `research.md` with decisions, rationales, and alternatives considered.

## Phase 1: Design & Contracts

### Prerequisites

`research.md` complete with all unknowns from Technical Context resolved.

### Data Model (data-model.md)

**Entities to define:**

1. **ProxyConfig**
   - Fields: protocol (HTTP/HTTPS/SOCKS5), server (host), port, username (optional), password (optional), source (global/session)
   - Validation rules:
     - protocol must be valid enum
     - server must be non-empty string
     - port must be 1-65535
     - username/password must both be present or both absent
   - State transitions: immutable once session is created

2. **ProxyProtocol** (enum)
   - Values: HTTP, HTTPS, SOCKS5

3. **SessionData** (existing, extended)
   - Add field: proxyConfig (ProxyConfig | null)
   - Relationship: one-to-one with ProxyConfig

4. **GlobalServerConfig** (conceptual, not a TypeScript entity)
   - Represents environment-loaded default proxy
   - Loaded once at server startup
   - Used as fallback when session doesn't specify proxy

### API Contracts (contracts/openapi.yaml)

**Modified Endpoints:**

1. **POST /sessions**
   - Add optional request field: `proxy` (object with server, port, protocol, username, password)
   - Validation errors:
     - 400 if proxy URL format invalid
     - 400 if proxy protocol unsupported
     - 400 if proxy authentication incomplete (username without password)
   - Example request:
     ```json
     {
       "ttl": 300000,
       "recording": false,
       "proxy": {
         "server": "proxy.brightdata.com",
         "port": 22225,
         "protocol": "http",
         "username": "customer-user",
         "password": "secret123"
       }
     }
     ```

**New Response Fields:**

- None (proxy configuration is not returned in responses for security)

### Quickstart (quickstart.md)

Create developer guide with:

1. How to set global proxy via environment variables
2. How to create session with custom proxy
3. Example curl commands for both scenarios
4. Troubleshooting common proxy errors

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh opencode` to add proxy-related technologies to AGENTS.md:

- Proxy URL parsing techniques
- Patchright proxy configuration API
- Pino credential redaction patterns

## Phase 2: Task Breakdown

**Not included in /speckit.plan command.** This phase will be executed by `/speckit.tasks` command after Phase 1 is complete.

Tasks will cover:

- Implement ProxyConfig types and validation
- Add proxy parsing service
- Extend session creation to accept proxy config
- Add global proxy loading from environment
- Implement credential redaction in logger
- Update OpenAPI documentation
- Manual testing with real proxy service

## Completion Status

### Phase 0: Outline & Research ✅ COMPLETE

**Completed**: 2025-11-22

Research findings documented in [research.md](./research.md):

- ✅ Playwright proxy configuration API (BrowserContext.newContext)
- ✅ Proxy URL parsing (Node.js built-in URL class)
- ✅ Pino credential redaction (redact config with custom censor)
- ✅ Environment variable conventions (HTTP_PROXY, HTTPS_PROXY, NO_PROXY)

All NEEDS CLARIFICATION items resolved.

### Phase 1: Design & Contracts ✅ COMPLETE

**Completed**: 2025-11-22

Artifacts generated:

- ✅ [data-model.md](./data-model.md) - ProxyConfig, ProxyProtocol, SessionData extensions
- ✅ [contracts/openapi.yaml](./contracts/openapi.yaml) - Extended POST /sessions with proxy config
- ✅ [quickstart.md](./quickstart.md) - Developer guide with examples
- ✅ Agent context updated ([AGENTS.md](../../AGENTS.md))

### Constitution Check (Post-Phase 1) ✅ PASS

**Re-validated**: 2025-11-22

All constitutional principles remain satisfied:

- ✅ Principle I: Simplicity First - No new abstractions, minimal code changes
- ✅ Principle II: TypeScript Foundation - ProxyConfig interfaces with strict types
- ✅ Principle III: HTTP-First Interface - Optional JSON field in existing endpoint
- ✅ Principle IV: Thin Playwright Wrapper - Direct mapping to Playwright proxy API
- ✅ Principle V: No Testing Requirements - Manual testing only
- ✅ Principle VI: Structured Logging & Observability - Pino redaction implemented

**Design Validation:**

- Data model adds 2 entities (ProxyConfig, ProxyProtocol enum)
- API contract adds 1 optional field to existing endpoint
- Implementation requires 2 new files (types/proxy.ts, services/proxy.ts)
- 4 existing files modified (routes/session.ts, services/session.ts, utils/logger.ts, server.ts)
- Complexity remains low, aligns with hobby project goals

### Next Phase

**Ready for Phase 2**: Task breakdown and implementation

Run `/speckit.tasks` to generate tasks.md and begin implementation.
