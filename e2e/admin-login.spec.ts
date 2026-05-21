import { test, expect } from '@playwright/test';

/**
 * Admin login critical path E2E.
 *
 * Tekshiradi:
 *   - login sahifa ochiladi
 *   - noto'g'ri parolda xato ko'rinadi
 *   - to'g'ri parol bilan dashboard'ga o'tadi va auth cookie o'rnatiladi
 *
 * Sirlarni env'dan oladi: ADMIN_USERNAME, ADMIN_PASSWORD.
 * CI'da bu ikkita secret repo secrets'ga qo'shilishi kerak (yoki test-only flow).
 */

const adminUser = process.env.ADMIN_USERNAME ?? 'admin';
const adminPass = process.env.ADMIN_PASSWORD ?? '';

test.describe('Admin login', () => {
    test('login sahifa ochiladi', async ({ page }) => {
        await page.goto('/admin/login');
        await expect(page).toHaveURL(/\/admin\/login/);
        // input maydonlari
        await expect(page.getByLabel(/(login|username|foydalanuvchi)/i)).toBeVisible();
        await expect(page.getByLabel(/(parol|password)/i)).toBeVisible();
    });

    test('noto\'g\'ri parol — xato ko\'rinadi', async ({ page }) => {
        await page.goto('/admin/login');
        await page.getByLabel(/(login|username|foydalanuvchi)/i).fill('admin');
        await page.getByLabel(/(parol|password)/i).fill('certainly-wrong-password-xyz');
        await page.getByRole('button', { name: /(kirish|login|войти)/i }).click();

        await expect(page.getByText(/(xato|noto'g'ri|invalid|wrong)/i)).toBeVisible({
            timeout: 10_000,
        });
        // URL hali login'da
        await expect(page).toHaveURL(/\/admin\/login/);
    });

    test('to\'g\'ri parol — admin dashboard ochiladi', async ({ page }) => {
        test.skip(!adminPass, 'ADMIN_PASSWORD env yo\'q — bu test o\'tkazib yuborildi');

        await page.goto('/admin/login');
        await page.getByLabel(/(login|username|foydalanuvchi)/i).fill(adminUser);
        await page.getByLabel(/(parol|password)/i).fill(adminPass);
        await page.getByRole('button', { name: /(kirish|login|войти)/i }).click();

        await page.waitForURL(/\/admin(\/|$)/, { timeout: 15_000 });
        // Auth cookie tekshiruvi
        const cookies = await page.context().cookies();
        const adminCookie = cookies.find((c) => c.name === 'pack24_admin_auth');
        expect(adminCookie).toBeTruthy();
        expect(adminCookie?.httpOnly).toBe(true);
    });
});
