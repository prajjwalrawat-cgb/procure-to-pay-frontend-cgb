import { expect, test } from '@playwright/test';

const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

// Slice 2 — an AUDITOR (Priya Rao) reviews the log, verifies the chain, and opens
// a row's before/after diff drawer.
test('audit: auditor verifies the chain and inspects a row', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('priya.rao@star-cement.example');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  await expect(page.getByTestId('audit-row').first()).toBeVisible();

  // Verify chain → modal reports a verified chain.
  await page.getByRole('button', { name: 'Verify chain' }).click();
  await expect(page.getByText(/Chain verified/)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // Filter to INV-4471 and open a row to see the before/after JSON diff.
  await page.getByPlaceholder('Search actor or entity id…').fill('inv_4471');
  await page.getByTestId('audit-row').first().click();
  await expect(page.getByText('Before')).toBeVisible();
  await expect(page.getByText('After')).toBeVisible();
});
