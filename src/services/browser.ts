import { Browser, chromium } from 'patchright';
import { logger } from '../utils/logger';

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    logger.info(
      {
        type: 'browser_launch',
        mode: 'headed',
        browser: 'chromium'
      },
      'Launching browser instance'
    );

    browserInstance = await chromium.launch({
      channel: 'chrome',
      headless: false
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
