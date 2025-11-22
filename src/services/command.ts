import { Page } from 'patchright';
import {
  CommandExecutionResult,
  CommandRequest,
  SequenceExecutionResponse,
  SessionLogEntry
} from '../types/command';
import {
  CommandNotFoundError,
  ElementNotFoundError,
  ExecutionError,
  TimeoutError
} from '../types/errors';
import { logCommandExecution, sanitizeParams } from '../utils/logger';
import { getSession } from './session';

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

  reload: async (page: Page, params: any) => {
    const { waitUntil } = params || {};
    await page.reload({ waitUntil: waitUntil || 'load' });
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

  content: async (page: Page, _params: any) => {
    const html = await page.content();
    return html;
  },

  // Page manipulation commands
  waitForSelector: async (page: Page, params: any) => {
    const { selector, timeout } = params;
    await page.locator(selector).waitFor({ timeout: timeout || 30000 });
    return null;
  },

  evaluate: async (page: Page, params: any) => {
    const { script, args } = params;

    // Use Patchright's native evaluate with args and isolated context
    // Third parameter (true) runs in isolated context
    const result = await page.evaluate(script, args, true);
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
  },

  // Timing commands
  wait: async (_page: Page, params: any) => {
    const { duration } = params;
    if (!duration || typeof duration !== 'number' || duration < 0) {
      throw new Error('Duration must be a positive number in milliseconds');
    }
    await new Promise((resolve) => setTimeout(resolve, duration));
    return null;
  },

  goBack: async (page: Page, params: any) => {
    const { waitUntil } = params || {};
    await page.goBack({ waitUntil: waitUntil || 'load' });
    return null;
  },

  goForward: async (page: Page, params: any) => {
    const { waitUntil } = params || {};
    await page.goForward({ waitUntil: waitUntil || 'load' });
    return null;
  },

  waitForLoadState: async (page: Page, params: any) => {
    const { state, timeout } = params || {};
    await page.waitForLoadState(state || 'load', { timeout });
    return null;
  },

  // Element state checking commands
  isVisible: async (page: Page, params: any) => {
    const { selector } = params;
    const isVisible = await page.locator(selector).isVisible();
    return isVisible;
  },

  isHidden: async (page: Page, params: any) => {
    const { selector } = params;
    const isHidden = await page.locator(selector).isHidden();
    return isHidden;
  },

  isEnabled: async (page: Page, params: any) => {
    const { selector } = params;
    const isEnabled = await page.locator(selector).isEnabled();
    return isEnabled;
  },

  isDisabled: async (page: Page, params: any) => {
    const { selector } = params;
    const isDisabled = await page.locator(selector).isDisabled();
    return isDisabled;
  },

  isEditable: async (page: Page, params: any) => {
    const { selector } = params;
    const isEditable = await page.locator(selector).isEditable();
    return isEditable;
  },

  isChecked: async (page: Page, params: any) => {
    const { selector } = params;
    const isChecked = await page.locator(selector).isChecked();
    return isChecked;
  },

  // Advanced interaction commands
  hover: async (page: Page, params: any) => {
    const { selector, options } = params;
    await page.locator(selector).hover(options);
    return null;
  },

  dblclick: async (page: Page, params: any) => {
    const { selector, options } = params;
    await page.locator(selector).dblclick(options);
    return null;
  },

  dragAndDrop: async (page: Page, params: any) => {
    const { sourceSelector, targetSelector, options } = params;
    await page.locator(sourceSelector).dragTo(page.locator(targetSelector), options);
    return null;
  },

  selectOption: async (page: Page, params: any) => {
    const { selector, values, options } = params;
    await page.locator(selector).selectOption(values, options);
    return null;
  },

  check: async (page: Page, params: any) => {
    const { selector, options } = params;
    await page.locator(selector).check(options);
    return null;
  },

  uncheck: async (page: Page, params: any) => {
    const { selector, options } = params;
    await page.locator(selector).uncheck(options);
    return null;
  },

  // Content retrieval commands
  innerHTML: async (page: Page, params: any) => {
    const { selector } = params;
    const html = await page.locator(selector).innerHTML();
    return html;
  },

  innerText: async (page: Page, params: any) => {
    const { selector } = params;
    const text = await page.locator(selector).innerText();
    return text;
  },

  inputValue: async (page: Page, params: any) => {
    const { selector } = params;
    const value = await page.locator(selector).inputValue();
    return value;
  },

  title: async (page: Page, _params: any) => {
    const title = await page.title();
    return title;
  },

  url: async (page: Page, _params: any) => {
    const url = page.url();
    return url;
  },

  // Utility commands
  bringToFront: async (page: Page, _params: any) => {
    await page.bringToFront();
    return null;
  },

  focus: async (page: Page, params: any) => {
    const { selector } = params;
    await page.locator(selector).focus();
    return null;
  },

  blur: async (page: Page, params: any) => {
    const { selector } = params;
    await page.locator(selector).blur();
    return null;
  },

  scrollIntoViewIfNeeded: async (page: Page, params: any) => {
    const { selector, options } = params;
    await page.locator(selector).scrollIntoViewIfNeeded(options);
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
        result: result === undefined ? null : result,
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
