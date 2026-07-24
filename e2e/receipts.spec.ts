import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 5 — goods receipt & RMA happy paths. Assumes the API (:3001) and web
 * (:3000) are running against a seeded Star Cement tenant (base + slices 1–5).
 */

const STORES_EMAIL = process.env.DEMO_STORES_EMAIL ?? 'r.kumar@star-cement.example';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test('stores officer sees the receipts list with pending POs', async ({ page }) => {
  await login(page, STORES_EMAIL);
  await page.goto('/goods-receipt');
  await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pending receipt' })).toBeVisible();
  // The two split-award POs (Patel 8T / Bhilai 4T) await receipt.
  await expect(page.getByText(/PO-049[34]/).first()).toBeVisible();
});

test('gate-entry wizard opens and lists issued POs', async ({ page }) => {
  await login(page, STORES_EMAIL);
  await page.goto('/goods-receipt/new');
  await expect(page.getByText('New goods receipt')).toBeVisible();
  await expect(page.getByText('Gate entry')).toBeVisible();
  // PO lookup select is present.
  await expect(page.locator('select').first()).toBeVisible();
});

test('receipts board shows QC and posted tabs', async ({ page }) => {
  await login(page, STORES_EMAIL);
  await page.goto('/goods-receipt');
  await page.getByRole('button', { name: 'Awaiting QC' }).click();
  await expect(page.getByRole('button', { name: 'Posted today' })).toBeVisible();
  await page.getByRole('button', { name: 'All' }).click();
  // Historical seeded GRNs (GRN-0310 / GRN-0311) are visible in "All".
  await expect(page.getByText(/GRN-03\d\d/).first()).toBeVisible();
});

test('RMA list renders', async ({ page }) => {
  await login(page, STORES_EMAIL);
  await page.goto('/rma');
  await expect(
    page.getByRole('heading', { name: 'Return authorisations' }),
  ).toBeVisible();
});
