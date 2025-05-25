import { Page, expect } from '@playwright/test';

export class CheckoutPage {
    // Locators
    private readonly continueButton = '[data-test="continue"]';
    private readonly firstNameInput = '[data-test="firstName"]';
    private readonly lastNameInput = '[data-test="lastName"]';
    private readonly postalCodeInput = '[data-test="postalCode"]';
    private readonly errorMessage = '[data-test="error"]';
    private readonly completeHeader = '.complete-header';
    private readonly finishButton = '[data-test="finish"]';

    constructor(private page: Page) {}

    // Form actions
    async clickContinue() {
        await this.page.locator(this.continueButton).click();
    }

    async fillCheckoutInfo(firstName: string, lastName: string, postalCode: string) {
        if (!firstName) {
            await expect(this.page.locator(this.errorMessage)).toHaveText('Error: First Name is required');
            return;
        }
        await this.page.locator(this.firstNameInput).fill(firstName);
        
        if (!lastName) {
            await expect(this.page.locator(this.errorMessage)).toHaveText('Error: Last Name is required');
            return;
        }
        await this.page.locator(this.lastNameInput).fill(lastName);
        
        if (!postalCode) {
            await expect(this.page.locator(this.errorMessage)).toHaveText('Error: Postal Code is required');
            return;
        }
        await this.page.locator(this.postalCodeInput).fill(postalCode);
        await this.clickContinue();
    }

    async finishCheckout() {
        await this.page.locator(this.finishButton).click();
    }

    // Validation methods
    async validateInvalidPostalCode(firstName: string, lastName: string, invalidPostalCode: string) {
        await this.page.locator(this.firstNameInput).fill(firstName);
        await this.page.locator(this.lastNameInput).fill(lastName);
        await this.page.locator(this.postalCodeInput).fill(invalidPostalCode);
        await this.clickContinue();
        await expect(this.page.locator(this.errorMessage)).toHaveText('Error: Invalid postal code format');
    }

    async validateOrderCompletion() {
        await expect(this.page.locator(this.completeHeader)).toHaveText('Thank you for your order!');
    }
}