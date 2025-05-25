import { chromium, FullConfig } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import testData from '../playwright-demo/data/testData.json';

async function globalSetup(config: FullConfig) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    const loginPage = new LoginPage(page);
    await page.goto('https://www.saucedemo.com/');
    await loginPage.login(testData.validUser.username, testData.validUser.password);

    // Store signed-in state
    await page.context().storageState({
        path: 'playwright/.auth/user.json'
    });

    await browser.close();
}

export default globalSetup;