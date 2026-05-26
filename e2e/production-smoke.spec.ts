/**
 * Production smoke tests — PLAYWRIGHT_BASE_URL=https://pack24.uz bilan ishga tushiring.
 * PLAYWRIGHT_NO_SERVER=1 — lokal dev server ishga tushirmaydi.
 */
import { test, expect } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const isProduction = base.includes('pack24.uz');

test.describe('Production smoke', () => {
    test('bosh sahifa 200', async ({ page }) => {
        const res = await page.goto('/');
        expect(res?.status()).toBeLessThan(500);
        await expect(page.locator('body')).toBeVisible();
    });

    test('katalog ochiladi', async ({ page }) => {
        await page.goto('/catalog');
        await expect(page).toHaveURL(/\/catalog/);
    });

    test('savat sahifasi', async ({ page }) => {
        await page.goto('/cart');
        await expect(page).toHaveURL(/\/cart/);
    });

    test('checkout sahifasi', async ({ page }) => {
        await page.goto('/checkout');
        await expect(page).toHaveURL(/\/checkout/);
    });

    test('admin login sahifasi', async ({ page }) => {
        await page.goto('/admin/login');
        await expect(page.locator('#admin-login')).toBeVisible({ timeout: 15_000 });
    });

    test('mobile WebApp bosh sahifa', async ({ page }) => {
        await page.goto('/mobile');
        await expect(page).toHaveURL(/\/mobile/);
        await expect(page.locator('body')).toBeVisible();
    });

    test('API health — categories', async ({ request }) => {
        const res = await request.get('/api/categories');
        expect(res.status()).toBeLessThan(500);
    });

    test('API health — products', async ({ request }) => {
        const res = await request.get('/api/products?limit=1');
        expect(res.status()).toBeLessThan(500);
    });
});

test.describe('Production-only checks', () => {
    test.skip(!isProduction, 'Faqat pack24.uz production URL da');

    test('HTTPS va domain', async ({ page }) => {
        await page.goto('/');
        expect(page.url()).toMatch(/^https:\/\/(www\.)?pack24\.uz/);
    });
});
