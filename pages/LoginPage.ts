import { Page } from '@playwright/test';

export class LoginPage {
    constructor(private page: Page) {}

    // Locators
    private usernameInput = () => this.page.locator('[data-test="username"]');
    private passwordInput = () => this.page.locator('[data-test="password"]');
    private loginButton = () => this.page.locator('[data-test="login-button"]');

    // Actions
    async login(username: string, password: string) {
        await this.usernameInput().fill(username);
        await this.passwordInput().fill(password);
        await this.loginButton().click();
    }
}
