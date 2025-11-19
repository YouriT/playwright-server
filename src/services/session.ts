import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { SessionData } from '../types/session';
import { RecordingMetadata } from '../types/recording';
import { getBrowser } from './browser';
import { MaxSessionsReachedError, SessionNotFoundError } from '../types/errors';
import { registerRecordingSession, markSessionEnded } from './recording';

// In-memory session store
const sessions = new Map<string, SessionData>();

// Configuration
const MAX_CONCURRENT_SESSIONS = parseInt(
  process.env.MAX_CONCURRENT_SESSIONS || '10',
  10
);
const PORT = process.env.PORT || 3000;
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || './recordings';

export interface CreateSessionOptions {
  ttl: number;
  recording?: boolean;
  videoSize?: {
    width: number;
    height: number;
  };
}

export async function createSession(
  options: CreateSessionOptions
): Promise<SessionData> {
  // Check session limit
  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    throw new MaxSessionsReachedError(MAX_CONCURRENT_SESSIONS);
  }

  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.ttl);

  const browser = await getBrowser();

  // Setup recording if enabled
  let recordingMetadata: RecordingMetadata | null = null;
  const contextOptions: any = {
    viewport: { width: 1920, height: 1080 },
  };

  if (options.recording) {
    const recordingPath = path.join(RECORDINGS_DIR, sessionId);
    contextOptions.recordVideo = {
      dir: recordingPath,
      size: options.videoSize || { width: 1280, height: 720 },
    };

    recordingMetadata = {
      enabled: true,
      playbackUrl: `http://localhost:${PORT}/recordings/${sessionId}/video.webm`,
      filePath: recordingPath,
      startedAt: now,
      size: options.videoSize,
    };

    // Register recording session for cleanup
    registerRecordingSession(sessionId, recordingPath);
  }

  // Create browser context
  const browserContext = await browser.newContext(contextOptions);
  await browserContext.newPage();

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
    console.error(`Error closing browser context for session ${sessionId}:`, error);
  }

  // After context closes, rename the video file to video.webm for consistent access
  if (session.recordingMetadata) {
    try {
      const fs = await import('fs/promises');
      const recordingDir = session.recordingMetadata.filePath;
      const files = await fs.readdir(recordingDir);
      const webmFile = files.find(file => file.endsWith('.webm'));
      
      if (webmFile && webmFile !== 'video.webm') {
        const sourcePath = path.join(recordingDir, webmFile);
        const destPath = path.join(recordingDir, 'video.webm');
        await fs.rename(sourcePath, destPath);
        console.log(`Recording finalized: ${destPath}`);
      }
    } catch (error) {
      console.error(`Error finalizing recording for session ${sessionId}:`, error);
    }
    
    markSessionEnded(sessionId);
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
