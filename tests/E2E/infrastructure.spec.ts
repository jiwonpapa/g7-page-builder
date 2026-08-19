import { expect, test } from '@playwright/test';

test('public application responds', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(page.locator('body')).not.toBeEmpty();
});

test('admin login form is usable', async ({ page }) => {
  const response = await page.goto('/admin/login');

  expect(response?.ok()).toBe(true);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});
