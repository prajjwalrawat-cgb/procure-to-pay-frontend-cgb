import { expect, test } from '@playwright/test';

const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

// Slice 2 — R. Das (CFO) finds INV-4471 in the inbox, opens it, and approves.
test('inbox: CFO approves INV-4471', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('r.das@star-cement.example');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/inbox');
  const row = page.getByRole('link', { name: 'INV-4471' });
  await expect(row).toBeVisible();
  await row.click();

  // The sticky action bar now offers the decision buttons for the current approver.
  await page
    .getByPlaceholder('Add a decision comment…')
    .fill('Approved after variance review');
  await page.getByRole('button', { name: 'Approve' }).click();

  // Back in the inbox, INV-4471 is gone (advanced to APPROVED).
  await expect(page).toHaveURL('/inbox');
  await expect(page.getByRole('link', { name: 'INV-4471' })).toHaveCount(0);
});
