import { Router, Request, Response, NextFunction } from 'express';
import { executeCommand, executeCommandSequence } from '../services/command';
import { ValidationError } from '../types/errors';
import { CommandRequest } from '../types/command';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

const router = Router();

// POST /sessions/:id/command - Execute command(s) on session
router.post('/:id/command', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Generate correlation ID for this request
    const correlationId = randomUUID();

    // Check if body is an array (sequence execution)
    if (Array.isArray(body)) {
      // Validate array is not empty
      if (body.length === 0) {
        throw new ValidationError('Command array cannot be empty');
      }

      // Validate each command in array
      for (let i = 0; i < body.length; i++) {
        const cmd = body[i];
        if (!cmd.command || typeof cmd.command !== 'string') {
          throw new ValidationError(`Command at index ${i} is missing or invalid`);
        }
      }

      // Execute command sequence with correlation ID
      const sequenceResult = await executeCommandSequence(
        id,
        body as CommandRequest[],
        correlationId,
        req.headers['user-agent']
      );

      // Return HTTP 207 Multi-Status for sequence execution
      res.status(207).json(sequenceResult);
      return;
    }

    // Single command execution (backward compatibility)
    const { command, selector, options } = body;

    // Validate command
    if (!command || typeof command !== 'string') {
      throw new ValidationError('Command is required and must be a string');
    }

    const startTime = performance.now();
    let result;

    try {
      // Execute command
      result = await executeCommand({
        sessionId: id,
        command,
        selector,
        options
      });

      const durationMs = performance.now() - startTime;

      // Log successful command execution
      logger.info(
        {
          type: 'command_execution',
          correlationId,
          sessionId: id,
          command,
          selector,
          durationMs: parseFloat(durationMs.toFixed(3)),
          status: 'success',
          params: options,
          metadata: {
            userAgent: req.headers['user-agent'],
            totalCommands: 1
          }
        },
        `Command executed: ${command}`
      );

      res.json({
        result,
        executedAt: new Date().toISOString(),
        durationMs: parseFloat(durationMs.toFixed(3))
      });
    } catch (err) {
      const durationMs = performance.now() - startTime;

      // Log failed command execution
      logger.error(
        {
          type: 'command_execution',
          correlationId,
          sessionId: id,
          command,
          selector,
          durationMs: parseFloat(durationMs.toFixed(3)),
          status: 'error',
          params: options,
          error: err instanceof Error ? err.message : String(err),
          metadata: {
            userAgent: req.headers['user-agent'],
            totalCommands: 1
          }
        },
        `Command failed: ${command}`
      );

      // Re-throw to be handled by error middleware
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
