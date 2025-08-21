import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class UploadPage extends BasePage {
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.locator('button:has-text("Upload")');
    this.successMessage = page.locator('.success-message');
  }

  async uploadFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
  }

  async getSuccessMessage(): Promise<string | null> {
    return this.successMessage.textContent();
  }
}
