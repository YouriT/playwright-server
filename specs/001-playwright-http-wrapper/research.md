# Research Document: Playwright HTTP Wrapper

**Feature Branch**: `001-playwright-http-wrapper`  
**Date**: 2025-11-19  
**Status**: Complete

This document consolidates research findings for all technical unknowns and technology choices identified during Phase 0 planning.

---

## Research Area 1: Web Framework Selection

### Decision

**Express** - A minimal, mature web framework for Node.js

### Rationale

Express aligns perfectly with Constitution Principle I (Simplicity First):

- **Simplest API**: Basic server setup in ~10 lines of code with intuitive `app.METHOD(path, handler)` pattern
- **Minimal footprint**: 197KB unpacked size with lightweight dependencies
- **Straightforward middleware**: Functions that take `(req, res, next)` with no framework-specific concepts
- **Massive ecosystem**: 66K+ GitHub stars, extensive documentation, instant Stack Overflow solutions
- **Battle-tested stability**: OpenJS Foundation backing with LTS timeline
- **Built-in JSON handling**: Native `express.json()` middleware
- **Simple error handling**: Standard `app.use((err, req, res, next) => {})` pattern

**Performance considerations**: The target <200ms p95 latency will be bottlenecked by Playwright/browser operations (100-1000ms+), not the web framework. Express can handle 10,000+ req/s, while the session limit of 5-10 concurrent browsers caps throughput at ~50-100 req/s maximum. Framework performance differences are irrelevant for this use case.

### Alternatives Considered

1. **Fastify**: 2-3x faster in benchmarks but adds unnecessary complexity (schema definitions, plugin system, opinionated architecture) that doesn't solve any concrete problem for this hobby project. Performance advantage meaningless when browser operations are 100x slower than framework overhead. Violates Simplicity First principle.

2. **Native Node.js http module**: Zero dependencies and maximum control, but requires 200-300+ lines of boilerplate code to replicate what Express provides (manual JSON parsing, URL routing, error handling, middleware pattern). Increases maintenance burden unnecessarily.

---

## Research Area 2: Patchright Integration Pattern

### Decision

**Command-Strategy Pattern with Session Manager Architecture**

Structure:

```
SessionManager (browser context lifecycle)
  └─> CommandExecutor (JSON to Patchright API mapping)
       └─> CommandRegistry (strategy pattern for commands)
            └─> Individual Command Handlers (click, type, navigate, etc.)
```

### Rationale

This pattern provides the best balance of Patchright compatibility, resource efficiency, session isolation, and maintainability:

**Patchright-Specific Advantages**:

- Using library mode (`import { chromium } from 'patchright'`) maintains all stealth patches
- Browser contexts provide perfect isolation for sessions (cookies, storage, authentication, navigation history)
- Context-level operations preserve CDP patches and anti-detection features
- Single browser instance across all sessions (memory efficient) with isolated contexts

**Session Management Benefits**:

- Easy cleanup via `context.close()` (automatically closes all pages)
- Video recording per context via `recordVideo` option
- Prevents cross-session contamination of browser state

**Command Mapping**:

- Strategy pattern allows easy extension of command set
- Type-safe command definitions with TypeScript
- Centralized validation and error handling
- Dynamic parameter resolution from JSON payload: `{"command": "click", "selector": "#button", "options": {}}`

**Resource Management**:

- Context-level cleanup is atomic and reliable
- Video files saved automatically on context close
- Graceful handling of orphaned sessions
- Single browser handles 100+ contexts efficiently

**Implementation Notes**:

```typescript
// Initialize Patchright once
const browser = await chromium.launch({ headless: true });

// Create session (browser context)
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: `./recordings/${sessionId}` }
});
const page = await context.newPage();

// Command execution via registry
const commandRegistry = {
  click: async (page, { selector, options }) => await page.locator(selector).click(options),
  navigate: async (page, { url, options }) => await page.goto(url, options),
  type: async (page, { selector, text }) => await page.locator(selector).fill(text)
  // ... more commands
};

// Cleanup
await context.close(); // Closes pages, saves video, releases resources
```

### Alternatives Considered

1. **Page-Based Sessions**: One page per session. Rejected because it loses cookie/storage isolation, shares authentication state, and cannot have independent video recordings. Breaks Patchright's context-based patches.

2. **Separate Browser Instances**: Each session launches new browser. Rejected due to high memory overhead (400-600MB per browser), defeats Patchright's design, and complex lifecycle management.

3. **Direct CDP/DevTools Protocol**: Would bypass Patchright's stealth patches completely. Not viable for stealth automation.

---

## Research Area 3: Session Management Strategy

### Decision

**Map-based session store with per-session setTimeout timers and periodic cleanup sweep**

Data structure:

```typescript
interface SessionData {
  id: string;
  ttl: number; // milliseconds
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date; // computed: lastActivityAt + ttl
  browserContext: BrowserContext; // Playwright context
  recordingMetadata?: {
    enabled: boolean;
    playbackUrl: string;
    filePath: string;
    startedAt: Date;
  };
  timeoutHandle: NodeJS.Timeout; // for cleanup
}

const sessions = new Map<string, SessionData>();
```

### Rationale

Aligns with Constitutional Principle I (Simplicity First) while meeting all technical requirements:

**Simplicity**:

- Minimal dependencies: Uses native JavaScript `Map` and Node.js timers (`setTimeout`, `clearTimeout`)
- No external libraries: No Redis, no session store packages, no complex state management
- Straightforward debugging: Can inspect `sessions` Map directly, timer handles are explicit
- O(1) lookups by session ID

**Meets All Requirements**:

- In-memory storage with fast lookups
- TTL tracking via `expiresAt` timestamp
- Automatic expiration via `setTimeout` triggers cleanup within seconds (requirement: within 30s)
- Keep-alive behavior: Reset TTL by clearing old timer and creating new one
- Session isolation: Each `SessionData` encapsulates its own browser context
- Concurrent sessions: `Map` naturally handles 10+ sessions without special logic

**Efficient Resource Management**:

- Lazy cleanup: Sessions only consume memory while active
- Proactive termination: Per-session timers ensure cleanup even if no new requests arrive
- Recording lifecycle: Decouples recording deletion (1 hour) from session cleanup (immediate)

**Edge Case Handling**:

- Browser crashes: Cleanup function is idempotent
- Background sweep (every 15s) catches sessions where timer failed
- Race conditions: Using `clearTimeout` before setting new timer prevents multiple cleanup attempts

**Implementation Notes**:

```typescript
// Session cleanup
async function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.timeoutHandle);
  await session.browserContext.close();

  if (session.recordingMetadata) {
    scheduleRecordingDeletion(session.recordingMetadata.filePath, 60 * 60 * 1000);
  }

  sessions.delete(sessionId);
}

// Keep-alive on command execution
function resetSessionTTL(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  clearTimeout(session.timeoutHandle);
  session.lastActivityAt = new Date();
  session.expiresAt = new Date(Date.now() + session.ttl);

  session.timeoutHandle = setTimeout(() => {
    cleanupSession(sessionId);
  }, session.ttl);
}
```

### Alternatives Considered

1. **Single setInterval with timestamp checking**: Rejected because it violates "within 30s" requirement (could be up to 10s delay), wasteful O(n) checks every interval, and less precise (10-second granularity vs millisecond-precise timers).

2. **Sorted expiration queue (priority queue/heap)**: Rejected as over-engineered for only 10 concurrent sessions. Requires heap data structure, complex TTL reset logic, and violates Simplicity First principle. Premature optimization.

3. **External store (Redis with TTL)**: Rejected because it violates Simplicity First principle, adds external dependency, and requirements explicitly state "no database per simplicity principle". Can't store browser contexts without serialization layer.

4. **Recursive setTimeout per session**: Rejected as less efficient (checks expiration constantly instead of waiting for actual expiry) and harder to cancel (need to track recursive chain).

---

## Research Area 4: Video Recording Implementation

### Decision

**Playwright's native WebM recording with session-based filesystem storage, scheduled cleanup worker, and Express static file serving**

Components:

- **Video Format**: WebM (VP8 codec) - Playwright's native output
- **Recording Setup**: `recordVideo: { dir: './recordings/<sessionId>' }` on context creation
- **Storage**: Hierarchical structure by session ID
- **Cleanup**: Background worker (setInterval every 15 minutes) deletes recordings 1+ hour after session end
- **HTTP Serving**: Express static middleware with proper MIME types
- **Performance When Disabled**: Zero overhead (option simply omitted)

### Rationale

**WebM Format Choice**:

- Native support: No transcoding pipeline needed
- Browser compatibility: Works in Chrome, Firefox, Edge, Opera (95%+ market share)
- Performance: Video available immediately after session ends
- Efficiency: ~5-10 MB per minute at 1280x720
- Trade-off: Limited Safari/iOS support (acceptable for MVP)

**Session-Based Directory Storage**:

- Cleanup simplicity: Delete entire directory atomically
- Conflict prevention: No filename collisions
- Isolation: Self-contained session recordings
- Quota management: Easy per-session size tracking

**Scheduled Cleanup Worker**:

- Reliability: Survives server restarts (can rebuild state from filesystem)
- Resource efficiency: 15-min interval balances disk space vs CPU overhead
- Predictability: Centralized cleanup logic, easy to monitor
- Grace period: 1-hour retention allows post-session video retrieval

**Express Static Middleware**:

- Production-ready: Battle-tested file serving
- Built-in features: Range requests for video seeking, automatic ETag caching
- Security: Easy authentication middleware integration
- Performance: Nginx-equivalent performance in Node.js

**Implementation Notes**:

```typescript
// Enable recording when creating session
const context = await browser.newContext({
  recordVideo: {
    dir: path.join(RECORDINGS_DIR, sessionId),
    size: { width: 1280, height: 720 } // Optional
  }
});

// Playback URL: GET /recordings/<sessionId>/video.webm
app.use(
  '/recordings',
  express.static(RECORDINGS_DIR, {
    setHeaders: (res, path) => {
      if (path.endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm');
      }
    }
  })
);

// Cleanup worker
const sessionMetadata = new Map(); // sessionId -> { endTime, recordingPath }

setInterval(
  async () => {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const [sessionId, metadata] of sessionMetadata.entries()) {
      if (metadata.endTime && now - metadata.endTime > ONE_HOUR) {
        await fs.rm(metadata.recordingPath, { recursive: true, force: true });
        sessionMetadata.delete(sessionId);
      }
    }
  },
  15 * 60 * 1000
);

// Performance impact:
// - Recording disabled: 0% overhead
// - Recording enabled: ~5-10% CPU, ~50-100 MB RAM per session
// - Storage: ~300-600 MB per 1-hour session
```

### Alternatives Considered

1. **MP4 Format with FFmpeg Transcoding**: Rejected due to high CPU overhead (1-2x video duration), external dependency, delayed availability, and increased complexity. WebM browser support is sufficient.

2. **Real-Time Streaming (No File Storage)**: Rejected due to complex implementation, no post-session playback capability, higher memory usage, and incompatibility with Playwright's file-based API.

3. **Cloud Storage (S3/Azure Blob) with Lifecycle Policies**: Rejected as over-engineering for MVP. Requires cloud credentials/billing, upload delays, and bandwidth costs. Good future enhancement for multi-region deployments.

4. **Database-Backed Cleanup Queue**: Rejected as it adds database dependency and over-engineers for single-server deployment. In-memory Map is sufficient.

5. **On-Demand Recording (Start/Stop API)**: Rejected as it complicates client integration. Full-session recording is simpler UX and standard practice. Can be added as optional enhancement later.

---

## Summary

All technical unknowns from the Technical Context section have been resolved:

| Unknown                | Decision                                      |
| ---------------------- | --------------------------------------------- |
| Web framework choice   | Express                                       |
| Patchright integration | Command-Strategy Pattern with Session Manager |
| Session management     | Map + per-session setTimeout                  |
| Video recording        | WebM with filesystem storage + cleanup worker |

All decisions prioritize simplicity, minimal dependencies, and alignment with the project constitution. Ready to proceed to Phase 1 (Design & Contracts).
