import fs from 'fs/promises';

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || './recordings';
const ONE_HOUR_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface SessionMetadata {
  sessionId: string;
  endTime: Date | null;
  recordingPath: string;
}

const sessionMetadata = new Map<string, SessionMetadata>();

export function registerRecordingSession(sessionId: string, recordingPath: string): void {
  sessionMetadata.set(sessionId, {
    sessionId,
    endTime: null,
    recordingPath,
  });
}

export function markSessionEnded(sessionId: string): void {
  const metadata = sessionMetadata.get(sessionId);
  if (metadata) {
    metadata.endTime = new Date();
  }
}

export async function cleanupOldRecordings(): Promise<void> {
  const now = Date.now();

  for (const [sessionId, metadata] of sessionMetadata.entries()) {
    if (metadata.endTime && now - metadata.endTime.getTime() > ONE_HOUR_MS) {
      try {
        await fs.rm(metadata.recordingPath, { recursive: true, force: true });
        sessionMetadata.delete(sessionId);
        console.log(`Cleaned up recording for session ${sessionId}`);
      } catch (error) {
        console.error(`Error cleaning up recording for session ${sessionId}:`, error);
      }
    }
  }
}

export function startRecordingCleanupScheduler(): void {
  setInterval(() => {
    cleanupOldRecordings();
  }, CLEANUP_INTERVAL_MS);

  console.log('Recording cleanup scheduler started');
}

export async function ensureRecordingsDirectory(): Promise<void> {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    console.log(`Recordings directory ensured: ${RECORDINGS_DIR}`);
  } catch (error) {
    console.error('Error creating recordings directory:', error);
    throw error;
  }
}
