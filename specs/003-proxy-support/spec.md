# Feature Specification: Proxy Configuration Support

**Feature Branch**: `003-proxy-support`  
**Created**: 2025-11-22  
**Status**: Draft  
**Input**: User description: "add support for setting a proxy like bright data. We should be able to do it on the env OR per session"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configure Global Proxy via Environment Variable (Priority: P1)

As a system administrator, I need to configure a proxy server (like Bright Data) via environment variables at server startup, so that all browser automation sessions automatically route traffic through the proxy without requiring per-session configuration.

**Why this priority**: This is the simplest and most common use case - setting a default proxy for all sessions. This represents the minimum viable product and provides immediate value for environments requiring consistent proxy usage.

**Independent Test**: Can be fully tested by setting proxy environment variables, starting the server, creating a session, and verifying browser traffic routes through the specified proxy.

**Acceptance Scenarios**:

1. **Given** proxy environment variables are set (proxy URL, credentials if needed), **When** the server starts, **Then** the server validates proxy configuration and logs confirmation
2. **Given** the server is configured with a global proxy, **When** a new session is created, **Then** the session's browser context uses the configured proxy automatically
3. **Given** a session is using the global proxy, **When** browser navigation occurs, **Then** all requests route through the proxy server
4. **Given** invalid proxy configuration is provided via environment variables, **When** the server starts, **Then** the server fails to start with a clear error message indicating the proxy configuration issue
5. **Given** no proxy environment variables are set, **When** the server starts, **Then** sessions operate without proxy (direct connection)

---

### User Story 2 - Configure Per-Session Proxy (Priority: P2)

As an API consumer, I need to specify a proxy server when creating individual sessions, so that I can use different proxies for different automation tasks (e.g., different geographic regions, different proxy providers, or mixed proxy/direct traffic).

**Why this priority**: While the global proxy covers most use cases, per-session configuration enables advanced scenarios like multi-region testing, A/B testing with different IPs, or selective proxy usage. This is valuable but not blocking for basic proxy functionality.

**Independent Test**: Can be fully tested by creating multiple sessions with different proxy configurations and verifying each session uses its specified proxy independently.

**Acceptance Scenarios**:

1. **Given** the server is running (with or without global proxy), **When** I create a session with proxy configuration in the request body, **Then** that session uses the specified proxy instead of the global default
2. **Given** I create a session with proxy configuration, **When** browser navigation occurs in that session, **Then** all requests route through the session-specific proxy
3. **Given** I create multiple sessions with different proxies, **When** commands execute in each session, **Then** each session maintains its own proxy configuration without interference
4. **Given** I create a session without proxy configuration and a global proxy is set, **When** the session is created, **Then** the session uses the global proxy as default
5. **Given** I create a session without proxy configuration and no global proxy is set, **When** the session is created, **Then** the session operates with direct connection (no proxy)
6. **Given** I provide invalid proxy configuration in the session creation request, **When** the request is processed, **Then** session creation fails with a clear error message indicating the proxy configuration issue

---

### User Story 3 - Support Authenticated Proxies (Priority: P2)

As an API consumer using commercial proxy services (like Bright Data, Smartproxy, Oxylabs), I need to authenticate with the proxy server using username and password, so that I can use proxies that require authentication.

**Why this priority**: Most commercial proxy providers require authentication, making this essential for production use. However, it's grouped with P2 as it extends P1 and P2 rather than being independently testable.

**Independent Test**: Can be fully tested by configuring a proxy with authentication credentials (both globally and per-session) and verifying successful authentication with the proxy server.

**Acceptance Scenarios**:

1. **Given** a global proxy with username and password is configured via environment variables, **When** a session is created, **Then** the browser authenticates with the proxy using the provided credentials
2. **Given** a session is created with proxy configuration including username and password, **When** the session makes requests, **Then** the browser authenticates with the proxy using the session-specific credentials
3. **Given** a proxy requires authentication but credentials are not provided, **When** the session attempts to make requests, **Then** requests fail with authentication error
4. **Given** incorrect proxy credentials are provided, **When** the session attempts to make requests, **Then** requests fail with clear authentication failure message

---

### Edge Cases

- What happens when proxy server becomes unavailable during an active session? Requests fail with connection errors; session remains active and may recover if proxy becomes available again
- What happens when proxy authentication fails mid-session? Requests fail with authentication errors; session behavior depends on proxy provider's error handling
- How does the system handle proxy configuration conflicts (global vs session-specific)? Session-specific configuration always takes precedence over global defaults
- What proxy URL formats are supported? Standard HTTP/HTTPS/SOCKS5 proxy URLs with optional authentication: `http://user:pass@host:port`, `https://user:pass@host:port`, `socks5://user:pass@host:port`, or without credentials: `http://host:port`, `https://host:port`, `socks5://host:port`
- What happens with HTTPS sites when using HTTP proxy? Standard HTTP proxy CONNECT tunnel is used for HTTPS traffic
- Are SOCKS proxies supported? Yes, SOCKS5 protocol is supported in addition to HTTP/HTTPS
- How are proxy credentials secured in logs and error messages? Credentials must be redacted/masked in all log output and error messages

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST accept proxy configuration via environment variables at server startup for global default proxy
- **FR-002**: System MUST support proxy configuration in session creation request for per-session proxy override
- **FR-003**: System MUST accept proxy configuration in standard URL format: `protocol://host:port` or `protocol://username:password@host:port`
- **FR-004**: System MUST support HTTP, HTTPS, and SOCKS5 proxy protocols
- **FR-005**: System MUST support authenticated proxies with username and password credentials
- **FR-006**: System MUST prioritize session-specific proxy configuration over global proxy configuration when both are present
- **FR-007**: System MUST validate proxy configuration (URL format, required fields) at server startup for global proxy
- **FR-008**: System MUST validate proxy configuration at session creation time for per-session proxy
- **FR-009**: System MUST fail server startup with clear error message if global proxy configuration is invalid
- **FR-010**: System MUST fail session creation with clear error message if session-specific proxy configuration is invalid
- **FR-011**: System MUST route all browser requests through the configured proxy (global or session-specific)
- **FR-012**: System MUST handle proxy connection failures gracefully and return clear error messages
- **FR-013**: System MUST support sessions without proxy when no global proxy is set and no session-specific proxy is provided
- **FR-014**: System MUST log proxy configuration (with credentials redacted) at server startup when global proxy is set
- **FR-015**: System MUST log proxy usage (with credentials redacted) when session is created with specific proxy
- **FR-016**: System MUST redact/mask proxy credentials in all log output and error messages to prevent credential leakage
- **FR-017**: System MUST maintain proxy configuration throughout session lifetime (no mid-session proxy changes)
- **FR-018**: System MUST support proxy configuration in Docker deployments via environment variables
- **FR-019**: System MUST support SOCKS5 proxy protocol in addition to HTTP and HTTPS proxy protocols
- **FR-020**: System SHOULD support configurable bypass rules to exclude localhost and internal networks from proxy routing for security and performance

### Key Entities

- **Proxy Configuration**: Represents proxy settings with protocol (HTTP/HTTPS/SOCKS5), server hostname, port, optional username, optional password, optional bypass rules, and configuration source (global/session-specific)
- **Session**: Extended to include optional proxy configuration that overrides global defaults; maintains proxy settings throughout session lifetime
- **Global Server Configuration**: Extended to include optional default proxy configuration loaded from environment variables at startup

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can configure a global proxy via environment variables and all sessions use the proxy without additional configuration
- **SC-002**: Users can create sessions with different proxies and each session maintains independent proxy configuration
- **SC-003**: Sessions with session-specific proxies use those proxies instead of global defaults 100% of the time
- **SC-004**: Invalid proxy configurations are detected at server startup or session creation with clear error messages
- **SC-005**: Proxy credentials never appear in plaintext in logs or error messages (100% redaction)
- **SC-006**: Sessions using proxies complete requests successfully with <5% failure rate when proxy adds network latency (measured by comparing response times to direct connections)
- **SC-007**: System handles proxy authentication failures gracefully with clear error messages indicating authentication issues
- **SC-008**: Users can operate sessions without proxy when no proxy configuration is provided (backward compatibility)

## Assumptions

- Proxy servers follow standard HTTP/HTTPS/SOCKS5 proxy protocols (CONNECT method for HTTPS, SOCKS5 handshake for SOCKS5)
- Proxy services like Bright Data use standard proxy authentication mechanisms
- Network latency introduced by proxies (100-500ms) is acceptable for automation use cases
- Proxy configuration is static for the lifetime of a session (no dynamic proxy rotation within a session)
- Environment variables for global proxy will follow standard naming conventions (e.g., `HTTP_PROXY`, `HTTPS_PROXY`) or custom prefix-based variables
- Proxy credentials in environment variables are secured by OS-level access controls
- Docker/container deployments can pass environment variables securely
- Session creation API already accepts optional configuration parameters in request body
- Playwright/Patchright supports proxy configuration at browser context creation time
- Proxy server availability is the responsibility of the proxy provider (no built-in proxy health checks)
- Default is no proxy (direct connection) if neither global nor session-specific proxy is configured

## Out of Scope

- Automatic proxy rotation within a session (proxy remains static for session lifetime)
- Proxy pool management or load balancing across multiple proxies
- Built-in proxy health checks or failover mechanisms
- Proxy performance monitoring or metrics collection
- Custom proxy authentication protocols beyond HTTP Basic/Digest
- Proxy configuration via API endpoints (only env vars and session creation supported)
- Modification of proxy configuration for active sessions (requires session recreation)
- Built-in proxy providers or proxy service integrations
- Proxy traffic logging or request inspection
