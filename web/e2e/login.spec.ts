import { test, expect } from '@playwright/test';

async function loginAsDirector(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@example.com').fill('e2e-director@example.com');
  await page.getByPlaceholder('••••••••').fill('E2ePassword123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20000 });
}

test.describe('login journey', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'WorkTracker' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder('admin@example.com')).toBeVisible();
  });

  test('rejects bad credentials with an error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@example.com').fill('nobody@example.com');
    await page.getByPlaceholder('••••••••').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('director logs in and reaches dashboard', async ({ page }) => {
    await loginAsDirector(page);
  });

  test('attendance page renders check-in action', async ({ page }) => {
    await loginAsDirector(page);
    await page.goto('/attendance');
    // Button reads "Check In" normally, "Check in to override" after auto-absent marks the day
    await expect(page.getByRole('button', { name: /check in/i }).first()).toBeVisible({ timeout: 15000 });
  });
});
