<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0
Amendment: Added Patchright browser requirement

Modified principles:
  - Updated Principle IV: Thin Playwright Wrapper to include Patchright requirement
  - Added Technical Constraints for browser configuration

Added sections:
  - Patchright browser channel requirement (Chrome only)
  - Rationale for Chrome enforcement

Templates requiring updates:
  ✅ .specify/templates/plan-template.md (Already compatible)
  ✅ .specify/templates/spec-template.md (No changes needed)
  ✅ .specify/templates/tasks-template.md (No changes needed)
  ⚠ Command files: No updates needed

Follow-up TODOs: None
-->

# Playwright Server Constitution

## Core Principles

### I. Simplicity First

This is a hobby project. Every design decision MUST prioritize simplicity over
theoretical perfection. Avoid premature abstractions, design patterns, or
architectural complexity unless solving a concrete problem that exists today.

**Rationale**: Hobby projects should be maintainable by a single developer
without extensive documentation or complex mental models. Simple code is
debuggable code.

### II. TypeScript Foundation

All code MUST be written in TypeScript with strict type checking enabled.
However, type complexity MUST be kept minimal - prefer simple interfaces and
types over advanced generic constructs unless absolutely necessary.

**Rationale**: TypeScript provides safety and IDE support without the overhead
of extensive test suites, which aligns with this project's no-test philosophy.

### III. HTTP-First Interface

The primary interface MUST be HTTP/REST endpoints. Every Playwright capability
exposed through this server MUST be accessible via HTTP requests with JSON
payloads. Endpoint design MUST be intuitive and follow RESTful conventions
where practical.

**Rationale**: HTTP is universal, debuggable with curl/Postman, and requires no
specialized client libraries. This maximizes accessibility and simplicity.

### IV. Thin Playwright Wrapper (via Patchright)

This server MUST remain a thin wrapper over Playwright's native API via the
Patchright library. Do not reinvent Playwright abstractions or create "improved"
versions of Playwright concepts. Map HTTP requests to Playwright calls as
directly as possible.

**Browser Requirement**: MUST use Patchright with Chrome browser only
(`channel: 'chrome'`). This is a hard requirement for Patchright's stealth
capabilities and MUST NOT be made configurable.

**Rationale**:

- Maintaining parity with Playwright's capabilities and avoiding duplication of effort
- Patchright requires Chrome for optimal stealth mode and bot detection evasion
- Users should be able to reference Playwright docs directly when using this server
- Chrome-only requirement is a Patchright best practice per official documentation

### V. No Testing Requirements (NON-NEGOTIABLE)

Tests are explicitly NOT required for this project. No unit tests, integration
tests, or contract tests MUST be written unless explicitly requested for a
specific feature. Code quality relies on TypeScript's type system and manual
validation during development.

**Rationale**: This is a hobby project with limited scope. The time investment
in comprehensive testing outweighs the benefits for a simple wrapper service.
TypeScript catches many bugs at compile time, and manual testing suffices for
HTTP endpoints.

### VI. Structured Logging & Observability

All production code MUST implement structured JSON logging for operational
visibility. Logs MUST include correlation IDs for request tracing, accurate
timing measurements, and automatic redaction of sensitive data.

**Rationale**: While tests are not required, production observability is
essential for debugging issues in deployed environments. Structured logs enable
efficient troubleshooting and performance analysis without requiring complex
monitoring infrastructure.

**Requirements**:

- Use Pino (or equivalent structured logger) with JSON output
- Include correlation IDs to trace related operations
- Measure and log operation timing with millisecond precision
- Automatically redact sensitive data (passwords, tokens, cookies, etc.)
- Support both production (JSON) and development (pretty-print) formats
- Configurable log levels via environment variables

## Technical Constraints

### Language & Runtime

- **Language**: TypeScript (strict mode enabled)
- **Runtime**: Node.js (latest LTS recommended)
- **Framework**: Minimal web framework (e.g., Express, Fastify, or native http)
- **Dependencies**: Patchright + web framework + minimal utilities only
- **Browser**: Chrome (required by Patchright, must be installed on system)

### Browser Configuration

- **Library**: Patchright (enhanced Playwright fork)
- **Channel**: `'chrome'` (hardcoded, NON-NEGOTIABLE)
- **Rationale**: Patchright's stealth mode requires Chrome; other browsers not supported
- **Documentation**: Chrome installation requirement MUST be documented in README

### API Design

- RESTful conventions where practical
- JSON for all request/response bodies
- Proper HTTP status codes (2xx success, 4xx client errors, 5xx server errors)
- Error responses MUST include human-readable error messages

### Configuration

- Environment variables for runtime configuration
- Sensible defaults for all optional settings
- No complex configuration file formats (JSON or .env only)
- Logging configuration MUST support `LOG_LEVEL` environment variable
- Browser channel is NOT configurable (always Chrome)

### Logging Standards

- **Library**: Pino (structured JSON logging)
- **Output**: JSON to stdout (production), pretty-print (development)
- **Correlation IDs**: UUID v4 for all HTTP requests, shared across operations
- **Timing**: Use `performance.now()` for microsecond-precision measurements
- **Sensitive Data**: Automatic redaction of passwords, tokens, cookies, API keys
- **Context Awareness**: Detect and redact sensitive inputs based on command context (e.g., typing into password fields)

### Security Considerations

- Input validation on all HTTP endpoints to prevent injection attacks
- Rate limiting SHOULD be considered for production deployments
- CORS configuration MUST be explicit and documented
- Authentication/authorization if needed MUST be simple (e.g., API keys)

## Development Workflow

### File Organization

- `src/` for all TypeScript source code
- `src/routes/` or `src/endpoints/` for HTTP endpoint definitions
- `src/services/` for Playwright interaction logic
- `src/types/` for TypeScript type definitions
- Keep nesting shallow (max 2-3 levels)

### Code Style

- Use consistent formatting (Prettier or similar recommended)
- Clear, descriptive variable and function names
- Inline comments only where logic is non-obvious
- Avoid clever code; prefer readable code

### Dependencies

- Minimize external dependencies
- Prefer well-maintained libraries with clear documentation
- Avoid dependencies that pull in large transitive dependency trees
- Document why each dependency is needed

### Version Control

- Commit frequently with clear, concise commit messages
- Use conventional commit format if desired but not required
- Feature branches optional (direct commits to main acceptable for hobby
  project)

## Governance

### Constitution Authority

This constitution defines the core rules for this project. All implementation
plans, specifications, and tasks MUST align with these principles. When in
doubt, refer back to Principle I (Simplicity First).

### Amendment Process

- Amendments can be made at any time by the project owner
- Version MUST increment following semantic versioning:
  - **MAJOR**: Principle removal or complete redefinition (e.g., adding test
    requirements)
  - **MINOR**: New principle added or existing principle materially expanded
  - **PATCH**: Clarifications, typo fixes, wording improvements
- All amendments MUST include rationale for the change
- Amendment date MUST be updated to reflect the change

### Compliance Review

- Every feature specification SHOULD reference relevant principles
- Implementation plans MUST include a "Constitution Check" confirming alignment
- When principles conflict with practical needs, document the trade-off and
  choose the path that best serves the project's hobby nature

### Template Synchronization

When this constitution is amended:

- Review `.specify/templates/plan-template.md` Constitution Check section
- Review `.specify/templates/spec-template.md` for requirement alignment
- Review `.specify/templates/tasks-template.md` for task type categorization
- Update any command files if agent-specific references need correction

**Version**: 1.2.0 | **Ratified**: 2025-11-19 | **Last Amended**: 2025-11-22
