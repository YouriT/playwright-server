import fs from 'fs/promises';
import { logger } from '../utils/logger';

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
    recordingPath
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
        logger.info(
          {
            type: 'recording_cleanup',
            sessionId,
            path: metadata.recordingPath
          },
          'Recording cleaned up'
        );
      } catch (error) {
        logger.error(
          {
            type: 'recording_cleanup',
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          },
          'Error cleaning up recording'
        );
      }
    }
  }
}

export function startRecordingCleanupScheduler(): void {
  setInterval(() => {
    cleanupOldRecordings();
  }, CLEANUP_INTERVAL_MS);

  logger.info(
    {
      type: 'recording_scheduler',
      interval: CLEANUP_INTERVAL_MS
    },
    'Recording cleanup scheduler started'
  );
}

export async function ensureRecordingsDirectory(): Promise<void> {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    logger.info(
      {
        type: 'recordings_directory',
        path: RECORDINGS_DIR
      },
      'Recordings directory ensured'
    );
  } catch (error) {
    logger.error(
      {
        type: 'recordings_directory',
        error: error instanceof Error ? error.message : String(error)
      },
      'Error creating recordings directory'
    );
    throw error;
  }
}
