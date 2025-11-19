import { Router, Request, Response, NextFunction } from 'express';
import {
  createSession,
  cleanupSession,
  getSession,
  getAllSessions,
  CreateSessionOptions,
} from '../services/session';
import { ValidationError } from '../types/errors';

const router = Router();

// POST /sessions - Create new session
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ttl, recording, videoSize } = req.body;

    // Validate TTL
    if (!ttl || typeof ttl !== 'number') {
      throw new ValidationError('TTL is required and must be a number');
    }

    if (ttl < 60000 || ttl > 14400000) {
      throw new ValidationError(
        'TTL must be between 60000ms (1 minute) and 14400000ms (4 hours)'
      );
    }

    const options: CreateSessionOptions = {
      ttl,
      recording: recording || false,
      videoSize,
    };

    const session = await createSession(options);

    const PORT = process.env.PORT || 3000;
    const response: any = {
      sessionId: session.id,
      sessionUrl: `http://localhost:${PORT}/sessions/${session.id}/command`,
      stopUrl: `http://localhost:${PORT}/sessions/${session.id}`,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    };

    if (session.recordingMetadata) {
      response.playbackUrl = session.recordingMetadata.playbackUrl;
    }

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /sessions/:id - Terminate session
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify session exists
    getSession(id);

    // Clean up session
    await cleanupSession(id);

    res.status(200).json({ message: 'Session terminated successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /sessions - List all active sessions (optional, for testing)
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = getAllSessions();
    const sessionList = sessions.map((session) => ({
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      ttl: session.ttl,
      remainingTTL: session.expiresAt.getTime() - Date.now(),
    }));

    res.json({ sessions: sessionList });
  } catch (error) {
    next(error);
  }
});

export default router;
