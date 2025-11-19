import { Router, Request, Response, NextFunction } from 'express';
import { executeCommand } from '../services/command';
import { ValidationError } from '../types/errors';

const router = Router();

// POST /sessions/:id/command - Execute command on session
router.post(
  '/:id/command',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { command, selector, options } = req.body;

      // Validate command
      if (!command || typeof command !== 'string') {
        throw new ValidationError('Command is required and must be a string');
      }

      // Execute command
      const result = await executeCommand({
        sessionId: id,
        command,
        selector,
        options,
      });

      res.json({
        result,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
