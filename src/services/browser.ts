import { chromium, Browser } from 'patchright';
import { logger } from '../utils/logger';

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    const headless = process.env.HEADLESS !== 'false';
    logger.info(
      {
        type: 'browser_launch',
        mode: headless ? 'headless' : 'headed'
      },
      'Launching browser instance'
    );
    browserInstance = await chromium.launch({
      headless
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
