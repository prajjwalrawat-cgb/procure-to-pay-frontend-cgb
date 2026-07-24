import { expect, test } from '@playwright/test';

// Slice 1 happy path (Master Context Slice 1 demo). Requires api+web running
// against a Slice-0 + Slice-1 seeded Star Cement tenant.
const EMAIL = process.env.DEMO_AP_EMAIL ?? 'm.iyer@star-cement.example';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

test('INV-4471: inbox → expand → detail → resolve exceptions → route to CFO', async ({
  page,
}) => {
  await login(page);

  // Inbox with rows.
  await page.getByRole('link', { name: 'Invoices' }).click();
  await expect(page).toHaveURL('/invoices');
  await expect(page.getByRole('link', { name: 'INV-4471' }).first()).toBeVisible();

  // Expand the INV-4471 row → 3 detail cards.
  await page.getByRole('button', { name: 'Expand INV-4471' }).click();
  await expect(page.getByText('3-way match')).toBeVisible();
  await expect(page.getByText('MSME clock')).toBeVisible();

  // Open the full detail.
  await page.getByRole('link', { name: 'Open full detail' }).click();
  await expect(page).toHaveURL('/invoices/inv_4471');
  await expect(page.getByRole('heading', { name: /INV-4471/ })).toBeVisible();

  // Resolve the rate variance.
  await page
    .getByTestId('exc-RATE_VARIANCE')
    .getByRole('button', { name: 'Resolve' })
    .click();
  await expect(page.getByText('Resolve exception')).toBeVisible();
  await page.getByRole('button', { name: 'Accept variance' }).click();
  await page
    .getByPlaceholder('Reason for this resolution…')
    .fill('Within delegated tolerance');
  await page.getByRole('button', { name: 'Save resolution' }).click();
  // Toast lives in the aria status region (avoids matching activity-log text).
  await expect(
    page.getByRole('status').getByText('Exception resolved').first(),
  ).toBeVisible();
  // Wait until the rate row is marked resolved (detail refetched) before continuing.
  await expect(page.getByTestId('exc-RATE_VARIANCE').getByText(/Resolved/)).toBeVisible();

  // Resolve the freight (unauthorised line) with a debit note.
  await page
    .getByTestId('exc-UNAUTHORISED_LINE')
    .getByRole('button', { name: 'Resolve' })
    .click();
  await page.getByRole('button', { name: 'Raise debit note' }).click();
  await page.getByPlaceholder('Reason for this resolution…').fill('Not on PO, FOB Surat');
  await page.getByRole('button', { name: 'Save resolution' }).click();
  await expect(
    page.getByText('All exceptions resolved. Ready to route for approval.'),
  ).toBeVisible();

  // Route for approval → back to inbox, status flips to Awaiting approval.
  await page.getByRole('button', { name: 'Resolve & route for approval' }).click();
  await expect(page.getByRole('status').getByText('Routed for approval')).toBeVisible();
  await expect(page).toHaveURL('/invoices');
});
