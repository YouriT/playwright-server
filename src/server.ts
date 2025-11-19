// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config({
  quiet: true,
  path: '.env.local',
});

import express, { Express } from 'express';
import path from 'path';
import { errorHandler } from './middleware/error';
import sessionRouter from './routes/session';
import commandRouter from './routes/command';
import {
  ensureRecordingsDirectory,
  startRecordingCleanupScheduler,
} from './services/recording';

const app: Express = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/sessions', sessionRouter);
app.use('/sessions', commandRouter);

// Static file serving for recordings
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || './recordings';
app.use('/recordings', express.static(path.resolve(RECORDINGS_DIR)));

// Error handling middleware (must be last)
app.use(errorHandler);

// Environment variable validation
function validateEnvironment(): void {
  const port = process.env.PORT || '3000';
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    console.warn(
      `Invalid PORT value "${port}". Using default port 3000.`
    );
    process.env.PORT = '3000';
  }

  const maxSessions = process.env.MAX_CONCURRENT_SESSIONS || '10';
  const maxSessionsNum = parseInt(maxSessions, 10);
  if (isNaN(maxSessionsNum) || maxSessionsNum < 1) {
    console.warn(
      `Invalid MAX_CONCURRENT_SESSIONS value "${maxSessions}". Using default value 10.`
    );
    process.env.MAX_CONCURRENT_SESSIONS = '10';
  }
}

// Server startup
const PORT = process.env.PORT || 3000;

async function startServer() {
  // Validate environment variables
  validateEnvironment();

  // Ensure recordings directory exists
  await ensureRecordingsDirectory();

  // Start recording cleanup scheduler
  startRecordingCleanupScheduler();

  app.listen(PORT, () => {
    console.log(`Playwright HTTP Wrapper server listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Max concurrent sessions: ${process.env.MAX_CONCURRENT_SESSIONS || 10}`);
  });
}

startServer();

export default app;
// Test comment
