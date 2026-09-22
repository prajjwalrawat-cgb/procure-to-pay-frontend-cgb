import { expect, test } from '@playwright/test';

const EMAIL = process.env.DEMO_EMAIL ?? 'harpreet@star-cement.example';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

// Slice 0 happy path: login → shell → ⌘K open/close → sidebar item → ComingInSlice.
test('login lands on the shell and navigation works', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Landed on the shell home.
  await expect(page).toHaveURL('/');
  // Home greets the signed-in user ("Good morning, Harpreet").
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/^Good (morning|afternoon|evening)/);

  // Command palette opens with ⌘K / Ctrl-K and closes with Escape.
  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Search routes and actions…')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('Search routes and actions…')).toBeHidden();

  // Clicking a still-unimplemented sidebar item shows the ComingInSlice placeholder.
  // (Requisitions/Purchase Orders are live as of Slice 4; Sourcing lands in Slice 6.)
  await page.getByRole('link', { name: 'Sourcing' }).click();
  await expect(page).toHaveURL('/sourcing');
  await expect(page.getByText('Coming in')).toBeVisible();
});
