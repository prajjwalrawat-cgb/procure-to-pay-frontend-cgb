import { expect, test, type Page } from '@playwright/test';

// Slice 3 happy path. Requires api + web running against a Slice 0-3 seeded
// Star Cement tenant (pnpm --filter db seed:slice3).
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Logout' }).first().click();
  await expect(page).toHaveURL('/login');
}

test('compose → approve → submit a payment run to the bank', async ({ page }) => {
  // 1. Compose as M. Iyer (Finance Officer).
  await login(page, 'm.iyer@star-cement.example');
  // Navigate within the SPA so the in-memory access token is retained.
  await page.getByRole('link', { name: 'Payment Runs' }).first().click();
  await expect(page).toHaveURL('/payment-runs');
  await page.getByRole('link', { name: 'New payment run' }).click();
  // Wait for bank accounts to load (the select defaults to the first one).
  await expect(
    page.locator('select[aria-label="Bank account"] option').first(),
  ).toBeAttached({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/payment-runs\/pay_/);
  const runUrl = page.url();

  // 2. Add invoices via the drawer (select everything payable).
  await page.getByRole('button', { name: 'Add invoices' }).click();
  await expect(page.getByRole('heading', { name: 'Add invoices' })).toBeVisible();
  const boxes = page.getByRole('checkbox');
  await expect(boxes.first()).toBeVisible();
  const count = await boxes.count();
  for (let i = 0; i < count; i += 1) await boxes.nth(i).check();
  await page.getByRole('button', { name: /Add \d+ invoice/ }).click();

  // 3. Batch + bank-file preview render.
  await expect(page.getByText(/Payment batch —/)).toBeVisible();
  await expect(page.getByText('Bank file preview')).toBeVisible();

  // 4. Submit for approval.
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByText('Awaiting approval').first()).toBeVisible();

  // 5. Finance Head (R. Das) approves.
  await logout(page);
  await login(page, 'r.das@star-cement.example');
  await page.goto(runUrl);
  await expect(page.getByText('Approval flow')).toBeVisible();
  const dasApprove = page.getByRole('button', { name: 'Approve' });
  await dasApprove.waitFor({ state: 'visible', timeout: 15_000 });
  await dasApprove.click();

  // 6. MD (A. Menon) approves the run (> ₹50L needs the MD step).
  await logout(page);
  await login(page, 'a.menon@star-cement.example');
  await page.goto(runUrl);
  await expect(page.getByText('Approval flow')).toBeVisible();
  const mdApprove = page.getByRole('button', { name: 'Approve' });
  const needsMd = await mdApprove
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (needsMd) await mdApprove.click();

  // 7. Run reached the bank (stub) and the file is downloadable. Reload-poll to
  //    ride out the dev server's watch-recompile blips.
  await expect(async () => {
    await page.goto(runUrl);
    await expect(page.getByText('Submitted to bank').first()).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Download .csv/ }).first()).toBeVisible();
});
