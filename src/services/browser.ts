import { chromium, Browser } from 'patchright';

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log(`Launching browser instance in ${process.env.HEADLESS !== 'false' ? 'headless' : 'headed'} mode`);
    browserInstance = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
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
