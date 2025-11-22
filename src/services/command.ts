import { Page } from 'patchright';
import { getSession } from './session';
import {
  CommandNotFoundError,
  TimeoutError,
  ElementNotFoundError,
  ExecutionError
} from '../types/errors';
import {
  CommandRequest,
  CommandExecutionResult,
  SequenceExecutionResponse,
  SessionLogEntry
} from '../types/command';
import { logCommandExecution, sanitizeParams } from '../utils/logger';

// Command handler type
type CommandHandler = (page: Page, params: any) => Promise<any>;

// Command registry
const commandRegistry: Record<string, CommandHandler> = {
  // Navigation commands
  navigate: async (page: Page, params: any) => {
    const { url, waitUntil } = params;
    await page.goto(url, { waitUntil: waitUntil || 'load' });
    return null;
  },

  goto: async (page: Page, params: any) => {
    const { url, waitUntil } = params;
    await page.goto(url, { waitUntil: waitUntil || 'load' });
    return null;
  },

  // Element interaction commands
  click: async (page: Page, params: any) => {
    const { selector, options } = params;
    await page.locator(selector).click(options);
    return null;
  },

  type: async (page: Page, params: any) => {
    const { selector, text } = params;
    await page.locator(selector).fill(text);
    return null;
  },

  fill: async (page: Page, params: any) => {
    const { selector, text } = params;
    await page.locator(selector).fill(text);
    return null;
  },

  press: async (page: Page, params: any) => {
    const { key } = params;
    await page.keyboard.press(key);
    return null;
  },

  // Data extraction commands
  textContent: async (page: Page, params: any) => {
    const { selector } = params;
    const text = await page.locator(selector).textContent();
    return text;
  },

  getAttribute: async (page: Page, params: any) => {
    const { selector, attribute } = params;
    const value = await page.locator(selector).getAttribute(attribute);
    return value;
  },

  screenshot: async (page: Page, params: any) => {
    const { fullPage, path } = params;
    const buffer = await page.screenshot({ fullPage, path });
    return buffer.toString('base64');
  },

  // Page manipulation commands
  waitForSelector: async (page: Page, params: any) => {
    const { selector, timeout } = params;
    await page.locator(selector).waitFor({ timeout: timeout || 30000 });
    return null;
  },

  evaluate: async (page: Page, params: any) => {
    const { script } = params;
    const result = await page.evaluate(script);
    return result;
  },

  setExtraHTTPHeaders: async (page: Page, params: any) => {
    const { headers } = params;
    const headersObj: Record<string, string> = {};

    if (Array.isArray(headers)) {
      headers.forEach((header: { name: string; value: string }) => {
        headersObj[header.name] = header.value;
      });
    } else {
      Object.assign(headersObj, headers);
    }

    await page.setExtraHTTPHeaders(headersObj);
    return null;
  },

  cookies: async (page: Page, _params: any) => {
    const cookies = await page.context().cookies();
    return { cookies };
  },

  setCookies: async (page: Page, params: any) => {
    const { cookies } = params;
    await page.context().addCookies(cookies);
    return null;
  }
};

export interface ExecuteCommandParams {
  sessionId: string;
  command: string;
  selector?: string;
  options?: Record<string, any>;
}

export async function executeCommand(params: ExecuteCommandParams): Promise<any> {
  const { sessionId, command, selector, options } = params;

  // Validate command exists
  const handler = commandRegistry[command];
  if (!handler) {
    throw new CommandNotFoundError(command);
  }

  // Get session
  const session = getSession(sessionId);

  // Get page from browser context
  const pages = session.browserContext.pages();
  if (pages.length === 0) {
    throw new ExecutionError('No active page in browser context');
  }
  const page = pages[0];

  try {
    // Prepare parameters for handler
    const commandParams: any = { ...options };
    if (selector) {
      commandParams.selector = selector;
    }

    // Execute command
    const result = await handler(page, commandParams);

    return result;
  } catch (error: any) {
    // Map Playwright errors to custom errors
    if (error.message && error.message.includes('Timeout')) {
      throw new TimeoutError(error.message);
    }
    if (
      error.message &&
      (error.message.includes('waiting for selector') || error.message.includes('not found'))
    ) {
      throw new ElementNotFoundError(selector || 'unknown');
    }
    throw new ExecutionError(error.message || 'Command execution failed');
  }
}

/**
 * Execute array of commands sequentially
 * Halts on first failure, returns partial results
 */
export async function executeCommandSequence(
  sessionId: string,
  commands: CommandRequest[],
  correlationId?: string,
  userAgent?: string
): Promise<SequenceExecutionResponse> {
  const results: CommandExecutionResult[] = [];
  const executedAt = new Date().toISOString();
  let halted = false;
  let currentUrl: string | undefined;

  // Get session to access page for metadata
  const session = getSession(sessionId);
  const pages = session.browserContext.pages();
  const page = pages.length > 0 ? pages[0] : null;

  for (let index = 0; index < commands.length; index++) {
    const cmd = commands[index];

    // Start high-precision timer
    const startTime = performance.now();

    try {
      // Execute command using existing executeCommand logic
      const result = await executeCommand({
        sessionId,
        command: cmd.command,
        selector: cmd.selector,
        options: cmd.options
      });

      // Calculate duration in milliseconds (with microsecond precision)
      const endTime = performance.now();
      const durationMs = Math.round((endTime - startTime) * 1000) / 1000;

      // Get current URL (non-confidential metadata)
      if (page) {
        try {
          currentUrl = await page.url();
        } catch {
          currentUrl = undefined;
        }
      }

      // Record success with timing
      const execResult: CommandExecutionResult = {
        index,
        command: cmd.command,
        status: 'success',
        result,
        durationMs,
        ...(cmd.selector && { selector: cmd.selector })
      };
      results.push(execResult);

      // Log to stdout with correlation ID and metadata
      const logEntry: SessionLogEntry = {
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown',
        sessionId,
        command: cmd.command,
        index,
        durationMs,
        status: 'success',
        ...(cmd.selector && { selector: cmd.selector }),
        params: sanitizeParams(cmd.options, cmd.command, cmd.selector),
        metadata: {
          userAgent,
          currentUrl,
          totalCommands: commands.length
        }
      };
      logCommandExecution(logEntry);
    } catch (error: any) {
      // Calculate duration in milliseconds (with microsecond precision)
      const endTime = performance.now();
      const durationMs = Math.round((endTime - startTime) * 1000) / 1000;

      // Get current URL even on error
      if (page) {
        try {
          currentUrl = await page.url();
        } catch {
          currentUrl = undefined;
        }
      }

      // Record failure with timing
      const execResult: CommandExecutionResult = {
        index,
        command: cmd.command,
        status: 'error',
        result: null,
        durationMs,
        error: error.message || 'Command execution failed',
        ...(cmd.selector && { selector: cmd.selector })
      };
      results.push(execResult);

      // Log to stdout with correlation ID and metadata
      const logEntry: SessionLogEntry = {
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown',
        sessionId,
        command: cmd.command,
        index,
        durationMs,
        status: 'error',
        error: error.message || 'Command execution failed',
        ...(cmd.selector && { selector: cmd.selector }),
        params: sanitizeParams(cmd.options, cmd.command, cmd.selector),
        metadata: {
          userAgent,
          currentUrl,
          totalCommands: commands.length
        }
      };
      logCommandExecution(logEntry);

      // Halt execution
      halted = true;
      break;
    }
  }

  return {
    results,
    completedCount: results.filter((r) => r.status === 'success').length,
    totalCount: commands.length,
    halted,
    executedAt
  };
}
