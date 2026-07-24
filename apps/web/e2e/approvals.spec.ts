import { expect, test } from '@playwright/test';

const EMAIL = process.env.DEMO_EMAIL ?? 'harpreet@star-cement.example';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

async function login(
  page: import('@playwright/test').Page,
  email = EMAIL,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

// Slice 2 — approval matrix builder: view seeded rules, build a new one, test
// with a sample, save as draft, and activate with the in-flight warning.
test('matrix builder: view rules, build, simulate, save, activate', async ({ page }) => {
  await login(page);
  await page.goto('/approvals');

  // Invoices tab is default and shows the 3 seeded rule cards.
  await expect(page.getByRole('heading', { name: 'Approval matrix' })).toBeVisible();
  await expect(page.getByTestId('rule-card')).toHaveCount(3);

  // Open the builder and build "MD approval above ₹1Cr".
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByTestId('rule-name').fill('MD approval above ₹1Cr');

  // Test with the hypothetical ₹1.2Cr sample → the chain resolves.
  await page
    .getByRole('combobox')
    .last()
    .selectOption({ label: '₹1.2Cr invoice (high)' });
  await page.getByRole('button', { name: 'Simulate' }).click();
  await expect(page.getByTestId('sim-result')).toBeVisible();

  // Save as draft, then confirm activation (warns about in-flight docs).
  await page.getByTestId('save-rule').click();
  await expect(page.getByText(/In-flight documents keep their snapshot/)).toBeVisible();
  await page.getByTestId('confirm-activate').click();
  await expect(page.getByText('Rule activated')).toBeVisible();
});
