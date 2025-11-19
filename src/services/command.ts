import { Page } from 'patchright';
import { getSession } from './session';
import { resetSessionTTL } from '../utils/ttl';
import {
  CommandNotFoundError,
  TimeoutError,
  ElementNotFoundError,
  ExecutionError,
} from '../types/errors';

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
  },
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

    // Reset TTL on successful command execution
    resetSessionTTL(session);

    return result;
  } catch (error: any) {
    // Map Playwright errors to custom errors
    if (error.message && error.message.includes('Timeout')) {
      throw new TimeoutError(error.message);
    }
    if (
      error.message &&
      (error.message.includes('waiting for selector') ||
        error.message.includes('not found'))
    ) {
      throw new ElementNotFoundError(selector || 'unknown');
    }
    throw new ExecutionError(error.message || 'Command execution failed');
  }
}
