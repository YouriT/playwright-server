import { BrowserContextOptions, chromium } from 'patchright';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getGlobalProxy } from '../server';
import { MaxSessionsReachedError, SessionNotFoundError } from '../types/errors';
import { ProxyConfig } from '../types/proxy';
import { RecordingMetadata } from '../types/recording';
import { SessionData } from '../types/session';
import { logger } from '../utils/logger';
import { toPlaywrightProxy } from './proxy';
import { markSessionEnded, registerRecordingSession } from './recording';

// In-memory session store
const sessions = new Map<string, SessionData>();

// Configuration
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10);
const PORT = process.env.PORT || 3000;
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || './recordings';
const USER_DATA_DIR = process.env.USER_DATA_DIR || './user-data';

export interface CreateSessionOptions {
  ttl: number;
  recording?: boolean;
  videoSize?: {
    width: number;
    height: number;
  };
  proxy?: ProxyConfig;
}

export async function createSession(options: CreateSessionOptions): Promise<SessionData> {
  // Check session limit
  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    throw new MaxSessionsReachedError(MAX_CONCURRENT_SESSIONS);
  }

  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.ttl);

  // Create unique user data directory for this session
  const userDataDir = path.join(USER_DATA_DIR, sessionId);

  // Determine effective proxy configuration (session-specific > global > none)
  const effectiveProxy = options.proxy || getGlobalProxy();

  // Setup recording if enabled
  let recordingMetadata: RecordingMetadata | null = null;
  const contextOptions: BrowserContextOptions = {
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  };

  // Add proxy configuration if available
  if (effectiveProxy) {
    contextOptions.proxy = toPlaywrightProxy(effectiveProxy);

    // Log proxy usage (credentials will be redacted)
    logger.info(
      {
        type: 'session_proxy',
        sessionId,
        proxyConfig: {
          protocol: effectiveProxy.protocol,
          hostname: effectiveProxy.hostname,
          port: effectiveProxy.port,
          hasAuth: !!(effectiveProxy.username && effectiveProxy.password),
          bypass: effectiveProxy.bypass
        },
        source: options.proxy ? 'session-specific' : 'global'
      },
      'Session created with proxy configuration'
    );
  }

  if (options.recording) {
    const recordingPath = path.join(RECORDINGS_DIR, sessionId);
    contextOptions.recordVideo = {
      dir: recordingPath,
      size: options.videoSize || { width: 1280, height: 720 }
    };

    recordingMetadata = {
      enabled: true,
      playbackUrl: `http://localhost:${PORT}/recordings/${sessionId}/video.webm`,
      filePath: recordingPath,
      startedAt: now,
      size: options.videoSize
    };

    // Register recording session for cleanup
    registerRecordingSession(sessionId, recordingPath);
  }

  logger.info(
    {
      type: 'browser_launch',
      sessionId,
      userDataDir,
      mode: 'headed',
      browser: 'chrome'
    },
    'Launching persistent browser context'
  );

  // Launch persistent browser context with dedicated user data directory
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    ...contextOptions
  });

  // Create session data
  const sessionData: SessionData = {
    id: sessionId,
    ttl: options.ttl,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    browserContext,
    timeoutHandle: setTimeout(() => {
      cleanupSession(sessionId);
    }, options.ttl),
    recordingMetadata,
    proxyConfig: effectiveProxy,
    userDataDir
  };

  sessions.set(sessionId, sessionData);

  return sessionData;
}

export async function cleanupSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Clear timeout
  clearTimeout(session.timeoutHandle);

  // Close browser context
  try {
    await session.browserContext.close();
  } catch (error) {
    logger.error(
      {
        type: 'session_cleanup',
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      },
      'Error closing browser context'
    );
  }

  // After context closes, rename the video file to video.webm for consistent access
  if (session.recordingMetadata) {
    try {
      const fs = await import('fs/promises');
      const recordingDir = session.recordingMetadata.filePath;
      const files = await fs.readdir(recordingDir);
      const webmFile = files.find((file) => file.endsWith('.webm'));

      if (webmFile && webmFile !== 'video.webm') {
        const sourcePath = path.join(recordingDir, webmFile);
        const destPath = path.join(recordingDir, 'video.webm');
        await fs.rename(sourcePath, destPath);
        logger.info(
          {
            type: 'recording_finalized',
            sessionId,
            path: destPath
          },
          'Recording finalized'
        );
      }
    } catch (error) {
      logger.error(
        {
          type: 'recording_finalization',
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        },
        'Error finalizing recording'
      );
    }

    markSessionEnded(sessionId);
  }

  // Delete user data directory
  try {
    const fs = await import('fs/promises');
    await fs.rm(session.userDataDir, { recursive: true, force: true });
    logger.info(
      {
        type: 'user_data_cleanup',
        sessionId,
        userDataDir: session.userDataDir
      },
      'User data directory deleted'
    );
  } catch (error) {
    logger.error(
      {
        type: 'user_data_cleanup',
        sessionId,
        userDataDir: session.userDataDir,
        error: error instanceof Error ? error.message : String(error)
      },
      'Error deleting user data directory'
    );
  }

  // Remove from store
  sessions.delete(sessionId);
}

export function getSession(sessionId: string): SessionData {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new SessionNotFoundError();
  }
  return session;
}

export function getAllSessions(): SessionData[] {
  return Array.from(sessions.values());
}
