import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('review the dashboard, log work, add an item', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('The house remembers');
  await expect(page.locator('.hero .due-row').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Open the dashboard' }).click();
  await expect(page.getByRole('img', { name: /Spending per month/ })).toBeVisible();
  await snap(page, 'dashboard');
  await checkMobile(page);

  await page.getByRole('link', { name: 'Log Replace furnace filter' }).click();
  await page.getByLabel('Cost (USD)').fill('21');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByRole('heading', { name: 'Gas furnace' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('$21', { exact: false }).first()).toBeVisible();
  await snap(page, 'asset');
  await checkMobile(page, 'asset-mobile');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home systems' }).click();
  await page.getByRole('link', { name: 'Add item' }).click();
  await page.getByLabel('Name').fill('Garage door opener');
  await page.getByLabel('Expected lifespan (years)').fill('12');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByRole('heading', { name: 'Garage door opener' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Service log' }).click();
  await page.getByLabel('Search').fill('furnace');
  await expect(page.getByText(/Showing 1–/)).toBeVisible();
  await snap(page, 'records');
});
