// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config({
  quiet: true,
  path: '.env.local'
});

import express, { Express } from 'express';
import path from 'path';
import { errorHandler } from './middleware/error';
import sessionRouter from './routes/session';
import commandRouter from './routes/command';
import { ensureRecordingsDirectory, startRecordingCleanupScheduler } from './services/recording';
import { getGlobalProxyConfig } from './services/proxy';
import { ProxyConfig } from './types/proxy';
import { logger } from './utils/logger';

// Global proxy configuration (loaded at startup)
let globalProxyConfig: ProxyConfig | null = null;

/**
 * Get the global proxy configuration
 * Returns null if no global proxy is configured
 */
export function getGlobalProxy(): ProxyConfig | null {
  return globalProxyConfig;
}

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
    logger.warn(
      {
        type: 'config_validation',
        field: 'PORT',
        value: port
      },
      'Invalid PORT value, using default 3000'
    );
    process.env.PORT = '3000';
  }

  const maxSessions = process.env.MAX_CONCURRENT_SESSIONS || '10';
  const maxSessionsNum = parseInt(maxSessions, 10);
  if (isNaN(maxSessionsNum) || maxSessionsNum < 1) {
    logger.warn(
      {
        type: 'config_validation',
        field: 'MAX_CONCURRENT_SESSIONS',
        value: maxSessions
      },
      'Invalid MAX_CONCURRENT_SESSIONS value, using default 10'
    );
    process.env.MAX_CONCURRENT_SESSIONS = '10';
  }
}

// Server startup
const PORT = process.env.PORT || 3000;

async function startServer() {
  // Validate environment variables
  validateEnvironment();

  // Load and validate global proxy configuration
  try {
    globalProxyConfig = getGlobalProxyConfig();
    if (globalProxyConfig) {
      logger.info(
        {
          type: 'proxy_config',
          source: 'global',
          protocol: globalProxyConfig.protocol,
          hostname: globalProxyConfig.hostname,
          port: globalProxyConfig.port,
          hasAuth: !!(globalProxyConfig.username && globalProxyConfig.password),
          bypass: globalProxyConfig.bypass
        },
        'Global proxy configured successfully'
      );
    }
  } catch (error) {
    // Proxy configuration errors are fatal - server cannot start with invalid proxy
    logger.error(
      {
        type: 'proxy_config_error',
        error: error instanceof Error ? error.message : String(error)
      },
      'Failed to load global proxy configuration - server startup aborted'
    );
    process.exit(1);
  }

  // Ensure recordings directory exists
  await ensureRecordingsDirectory();

  // Start recording cleanup scheduler
  startRecordingCleanupScheduler();

  app.listen(PORT, () => {
    logger.info(
      {
        type: 'server_start',
        port: PORT,
        maxConcurrentSessions: process.env.MAX_CONCURRENT_SESSIONS || 10,
        healthCheck: `http://localhost:${PORT}/health`,
        globalProxy: globalProxyConfig ? true : false
      },
      'Playwright HTTP Wrapper server started'
    );
  });
}

startServer();

export default app;
