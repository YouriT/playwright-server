# Feature Specification: Playwright HTTP Wrapper

**Feature Branch**: `001-playwright-http-wrapper`  
**Created**: 2025-11-19  
**Status**: Draft  
**Input**: User description: "create a http webserver that will wrap all playwright (via patchright) functions and server them over http. Priniciple is simple: user starts a session with a ttl and receives a session URL + stop URL. He can then perform all usual calls over http via a simple wrapper endpoint"

## Clarifications

### Session 2025-11-19

- Q: Command payload format for the wrapper endpoint? → A: Direct method mapping with flat JSON structure: `{"command": "click", "selector": "#button", "options": {}}`
- Q: Which browser types should sessions support? → A: Chromium only
- Q: What should happen when a session's TTL expires while a command is executing? → A: Immediately terminate session and command
- Q: How should the system respond to requests for a session that doesn't exist or has expired? → A: HTTP 404 with error message
- Q: How should the system handle browser crashes or malformed commands that cause execution failures? → A: Clean up session, return error, auto-terminate
- Q: Should session recording be supported? → A: Yes, optional recording enabled at session creation with playback URL in response
- Q: What format should session recordings use? → A: Video recording (MP4/WebM)
- Q: How long should recordings be retained after session termination? → A: 1 hour
- Q: What should happen when a client loses connection mid-command? → A: Abort command immediately

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Start Browser Session (Priority: P1)

As an automation developer, I need to start a new browser automation session via HTTP and receive unique URLs to control that session, so that I can orchestrate browser automation from any HTTP client without installing Playwright locally.

**Why this priority**: This is the foundational capability - without session creation, no other operations are possible. This represents the minimum viable product.

**Independent Test**: Can be fully tested by sending an HTTP request to create a session, receiving session and stop URLs, and verifying the session is active and accessible.

**Acceptance Scenarios**:

1. **Given** the HTTP server is running, **When** I send a POST request to create a new session with a 30-minute TTL, **Then** I receive a unique session URL and stop URL in the response
2. **Given** I create a session with recording enabled, **When** the session is created, **Then** I also receive a playback URL in the response
3. **Given** a session has been created, **When** I access the session URL, **Then** the session is active and ready to receive commands
4. **Given** a session has been created with a 5-minute TTL, **When** 5 minutes elapse without activity, **Then** the session automatically terminates and cleans up resources
5. **Given** I have a stop URL for an active session, **When** I send a request to the stop URL, **Then** the session terminates immediately and releases all resources

---

### User Story 2 - Execute Playwright Commands (Priority: P2)

As an automation developer, I need to execute any Playwright/Patchright command on my active session via HTTP, so that I can perform browser automation tasks like navigation, clicking, typing, and data extraction.

**Why this priority**: Once sessions exist, users need to actually control browsers. This is the core value proposition of the wrapper.

**Independent Test**: Can be tested by creating a session (from US1), sending various Playwright commands via the wrapper endpoint, and verifying the commands execute correctly and return expected results.

**Acceptance Scenarios**:

1. **Given** an active session, **When** I send a navigation command to visit a URL, **Then** the browser navigates to that URL and confirms success
2. **Given** an active session on a page, **When** I send a command to click an element by selector, **Then** the element is clicked and any resulting page changes occur
3. **Given** an active session on a page, **When** I send a command to extract text from an element, **Then** I receive the text content in the HTTP response
4. **Given** an active session, **When** I send multiple commands in sequence, **Then** each command executes in order on the same browser context
5. **Given** I send a command with invalid parameters, **When** the command fails, **Then** I receive a clear error message explaining what went wrong

---

### User Story 3 - Record and Replay Sessions (Priority: P3)

As an automation developer or QA tester, I need to optionally record my browser automation sessions and receive a playback URL, so that I can review what happened during the session, debug issues, and share session recordings with team members.

**Why this priority**: While the core automation functionality works without recording, having the ability to review sessions greatly improves debugging and documentation capabilities. This is valuable but not blocking for basic automation needs.

**Independent Test**: Can be tested by creating a session with recording enabled, executing several commands, stopping the session, and verifying the playback URL serves a viewable recording of all actions.

**Acceptance Scenarios**:

1. **Given** the HTTP server is running, **When** I send a POST request to create a new session with recording enabled, **Then** I receive session URL, stop URL, and a playback URL in the response
2. **Given** a session was created with recording enabled, **When** I execute multiple commands during the session, **Then** all commands and browser interactions are captured in the recording
3. **Given** a recorded session has ended, **When** I access the playback URL, **Then** I can view a replay of the entire session showing all browser actions
4. **Given** I create a session without enabling recording, **When** the session is created, **Then** no playback URL is provided and no recording overhead occurs
5. **Given** a recorded session, **When** the session terminates (via TTL or stop URL), **Then** the recording is finalized and the playback URL remains accessible

---

### User Story 4 - Manage Multiple Concurrent Sessions (Priority: P4)

As a system administrator or power user, I need to run multiple browser automation sessions simultaneously on the same server, so that I can parallelize automation tasks and improve throughput.

**Why this priority**: While nice-to-have for scalability, a single-session system would still provide value. This is an enhancement for power users.

**Independent Test**: Can be tested by creating multiple sessions simultaneously, executing commands on each independently, and verifying sessions don't interfere with each other.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** I create 5 sessions simultaneously, **Then** each session receives unique URLs and operates independently
2. **Given** multiple active sessions exist, **When** I execute commands on one session, **Then** other sessions are unaffected and continue operating normally
3. **Given** multiple sessions are active, **When** one session's TTL expires, **Then** only that session terminates while others remain active
4. **Given** multiple sessions are running, **When** I query session status, **Then** I can see a list of all active sessions with their remaining TTL

---

### Edge Cases

- Session TTL expiration during command execution: System immediately terminates the session and aborts the running command, returning an error to the client
- Requests to non-existent or expired session: System returns HTTP 404 status code with a clear error message indicating the session was not found
- What happens when the server reaches maximum concurrent session limits?
- Malformed commands or browser crashes: System automatically terminates the affected session, cleans up all resources, and returns a detailed error response to the client
- Recording playback URL access after session ends: Playback URL remains accessible for 1 hour after session termination, then returns HTTP 404
- Recording storage limits: Recordings are automatically deleted 1 hour after session termination to prevent unbounded storage growth
- Client connection loss mid-command: System immediately aborts the running command and frees resources, session remains active for new commands
- How are browser processes cleaned up if a session terminates abnormally (crash, server restart)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST expose an HTTP endpoint to create new browser automation sessions
- **FR-002**: System MUST generate a unique session URL for each created session
- **FR-003**: System MUST generate a unique stop URL for each created session
- **FR-004**: System MUST accept a time-to-live (TTL) parameter when creating sessions
- **FR-005**: System MUST automatically terminate sessions when their TTL expires, immediately aborting any in-progress commands
- **FR-006**: System MUST support manual session termination via the stop URL
- **FR-007**: System MUST clean up all browser processes and resources when a session terminates
- **FR-008**: System MUST expose a generic wrapper endpoint that accepts Playwright/Patchright commands as HTTP payloads with direct method mapping format: `{"command": "commandName", "selector": "...", "options": {...}}`
- **FR-009**: System MUST execute received Playwright commands on the correct session's browser context
- **FR-010**: System MUST return command execution results in the HTTP response
- **FR-011**: System MUST support all core Playwright operations: navigation, element interaction, data extraction, screenshots, and page manipulation
- **FR-012**: System MUST use Patchright (stealth Playwright fork) with Chromium browser as the underlying automation library
- **FR-013**: System MUST maintain session isolation - commands sent to one session must not affect other sessions
- **FR-014**: System MUST return appropriate HTTP status codes (2xx for success, 4xx for client errors, 5xx for server errors)
- **FR-015**: System MUST provide clear error messages when commands fail or sessions are invalid, returning HTTP 404 for non-existent or expired sessions
- **FR-016**: System MUST reset session TTL on each successful command execution (keep-alive behavior)
- **FR-017**: System MUST persist session state between commands within the same session
- **FR-018**: System MUST support a configurable maximum number of concurrent sessions via environment variable at server startup
- **FR-019**: System MUST reject new session creation requests when the maximum concurrent session limit is reached
- **FR-020**: System MUST provide a clear error message when session creation fails due to reaching the maximum limit
- **FR-021**: System MUST automatically terminate sessions and clean up resources when browser crashes or unrecoverable command failures occur
- **FR-022**: System MUST return detailed error responses when command execution fails, including error type and description
- **FR-023**: System MUST accept an optional recording parameter when creating sessions to enable session recording
- **FR-024**: System MUST generate a unique playback URL when recording is enabled for a session
- **FR-025**: System MUST capture all browser interactions as video recording (MP4 or WebM format) when recording is enabled
- **FR-026**: System MUST make recordings accessible via the playback URL after session termination
- **FR-027**: System MUST NOT incur recording overhead when recording is not enabled for a session
- **FR-028**: System MUST automatically delete recording files 1 hour after session termination to manage storage
- **FR-029**: System MUST abort in-progress commands when client connection is lost and free associated resources

### Key Entities

- **Session**: Represents an active browser automation session with unique identifier, session URL, stop URL, playback URL (if recording enabled), TTL, creation timestamp, last activity timestamp, recording status, and associated browser context
- **Command**: Represents a Playwright/Patchright operation with command name (e.g., "click", "goto", "textContent"), selector (CSS/XPath selector string), options (additional parameters as key-value pairs), and execution result
- **Browser Context**: The underlying Patchright browser instance and page associated with a session, including browser state, cookies, and navigation history
- **Recording**: Represents a captured session recording with playback URL, video file location (MP4/WebM format), recording start/end timestamps, and video metadata

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a new session and receive session URLs in under 5 seconds
- **SC-002**: Users can execute basic Playwright commands (navigate, click, extract text) and receive results in under 10 seconds per command
- **SC-003**: Sessions automatically terminate within 30 seconds of TTL expiration
- **SC-004**: System successfully cleans up 100% of browser processes when sessions terminate
- **SC-005**: System can handle at least 5 concurrent sessions without performance degradation
- **SC-006**: 95% of valid commands execute successfully and return expected results
- **SC-007**: Users can complete a full automation workflow (create session, execute multiple commands, stop session) in under 2 minutes
- **SC-008**: Error messages are clear enough that 90% of users can understand and fix issues without support
- **SC-009**: Recordings are accessible via playback URL within 10 seconds of session termination and remain available for 1 hour
- **SC-010**: Sessions without recording enabled have no performance overhead compared to sessions with recording disabled

## Assumptions

- Users have basic knowledge of HTTP requests (POST, GET) and JSON
- Users are familiar with Playwright API concepts (selectors, page navigation, element interaction)
- The server will run on a single machine initially (distributed deployment is out of scope)
- Network latency between client and server is reasonable (<1 second)
- Sessions will be used for short-lived automation tasks (minutes to hours, not days)
- Browser automation will be primarily headless (visible browser windows are optional enhancement)
- All sessions will use Chromium browser exclusively (Firefox and WebKit support out of scope)
- Security is handled at the network level (firewall, VPN) rather than application-level authentication initially
- Default TTL will be 30 minutes if not specified by the user
- Commands will be executed synchronously (client waits for response before sending next command)
- Default maximum concurrent sessions will be 10 if not configured via environment variable
- Server administrators will configure the session limit based on their hardware capabilities
- Recording is optional and disabled by default to minimize resource usage
- Recordings will be stored as video files (MP4 or WebM format) and automatically deleted 1 hour after session termination

## Out of Scope

- User authentication and authorization (may be added in future iteration if needed)
- Command queuing or asynchronous execution
- Distributed server deployment across multiple machines
- Integration with specific CI/CD platforms
- WebSocket-based real-time streaming
- Session persistence across server restarts
- Advanced browser debugging features (DevTools protocol)
- Session sharing between multiple clients
- Live streaming of browser viewport during session execution
- Recording editing or post-processing capabilities
