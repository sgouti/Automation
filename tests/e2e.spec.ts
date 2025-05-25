import { test, expect } from '@playwright/test';
import { ProductPage } from '../pages/ProductPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import testData from '../data/testData.json';

test.afterAll(async ({ browser }) => {
    await browser.close();
});

test.describe('Product Order Flow', () => {
    let productPage: ProductPage;
    let checkoutPage: CheckoutPage;

    test.beforeEach(async ({ page }) => {
        productPage = new ProductPage(page);
        checkoutPage = new CheckoutPage(page);
        await page.goto('/inventory.html');
    });

    test('should complete end-to-end order flow for watch', async ({ page }) => {
        await productPage.addProductToCart(testData.products.watch);
        await productPage.goToCheckout();        
        await checkoutPage.fillCheckoutInfo('John', 'Smith', '12345');
        await checkoutPage.finishCheckout();
        await checkoutPage.validateOrderCompletion();
    });

    test('should complete end-to-end order flow for backpack', async ({ page }) => {
        await productPage.addProductToCart(testData.products.backpack);
        await productPage.goToCheckout();
        await checkoutPage.fillCheckoutInfo('John', 'Doe', '12345');
        await checkoutPage.finishCheckout();
        await checkoutPage.validateOrderCompletion();
    });

    test('should complete end-to-end order flow for t-shirt', async ({ page }) => {
        await productPage.addProductToCart(testData.products.blackTShirt);
        await productPage.goToCheckout();
        await checkoutPage.fillCheckoutInfo('Jane', 'Smith', '54321');
        await checkoutPage.finishCheckout();
        await checkoutPage.validateOrderCompletion();
    });

    test('should display appropriate error messages for invalid checkout information', async ({ page }) => {
        // Add product to cart and go to checkout
        await productPage.addProductToCart(testData.products.backpack);
        await productPage.goToCheckout();

        // Try to checkout with no information
        await checkoutPage.fillCheckoutInfo('', '', '');

        // Try with first name only
        await checkoutPage.fillCheckoutInfo('John', '', '');

        // Try with missing postal code
        await checkoutPage.fillCheckoutInfo('John', 'Doe', '');

        // Try with invalid postal code
        await checkoutPage.validateInvalidPostalCode('John', 'Doe', '!@#$%');
    });
});
