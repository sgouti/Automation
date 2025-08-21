import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
import { Page, Browser, chromium } from '@playwright/test';

export class CustomWorld extends World {
  browser!: Browser;
  page!: Page;

  constructor(options: IWorldOptions) {
    super(options);
  }

  async openBrowser() {
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async closeBrowser() {
    await this.browser.close();
  }
}

setWorldConstructor(CustomWorld);
