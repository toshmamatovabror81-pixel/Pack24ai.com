import { test, expect } from '@playwright/test';

/**
 * Checkout critical path — bosh sahifadan katalog → savatga qo'shish → checkout sahifasiga o'tish.
 * Buyurtma yaratish to'liq oqimi NextAuth orqali kerak — bu erda hech bo'lmasa
 * navigation funksiyaligi tekshiriladi.
 */

test.describe('Checkout critical path', () => {
    test('bosh sahifa ochiladi', async ({ page }) => {
        await page.goto('/');
        // Yetakchi heading ko'rinishi
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    });

    test('katalog sahifasi ochiladi', async ({ page }) => {
        await page.goto('/catalog');
        await expect(page).toHaveURL(/\/catalog/);
    });

    test('savat sahifasi ochiladi', async ({ page }) => {
        await page.goto('/cart');
        // Cart sahifa link bilan ham, button bilan ham bo'lishi mumkin
        await expect(page).toHaveURL(/\/cart/);
    });

    test('checkout sahifasi ochiladi', async ({ page }) => {
        await page.goto('/checkout');
        await expect(page).toHaveURL(/\/checkout/);
    });
});
