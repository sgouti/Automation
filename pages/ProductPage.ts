import { Page } from '@playwright/test';

export class ProductPage {
    constructor(private page: Page) {
        // Setup dialog handler
        this.page.on('dialog', async dialog => {
            await dialog.accept();
        });
    }

    // Locators
    private addToCartButton = (productName: string) => this.page.locator(`[class="inventory_item"]:has-text("${productName}") [data-test^="add-to-cart"]`);
    private shoppingCartButton = () => this.page.locator('.shopping_cart_link');
    private checkoutButton = () => this.page.locator('[data-test="checkout"]');
    
    // Actions
    async addProductToCart(productName: string) {
        await this.addToCartButton(productName).click();
    }

    async goToCheckout() {
        await this.shoppingCartButton().click();
        await this.checkoutButton().click();
    }
}
