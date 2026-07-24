import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WCAG 2.1 AA automated audit of the buyer core flows (Master Context §13:
 * "WCAG 2.1 AA on buyer core flows"). Uses axe-core, which covers the machine-
 * checkable subset — colour contrast, ARIA validity, landmark/heading structure,
 * form labels, image alt text. It does NOT replace manual keyboard-and-screen-
 * reader testing; those findings are tracked in docs/compliance/accessibility-review.md.
 *
 * Static token contrast is additionally gated headless by
 * `pnpm --filter @procureflow/ui contrast:check`; this suite catches the live-DOM
 * issues that static check cannot see.
 *
 * Prerequisites (same as the rest of e2e): API :3001 + web :3000 running against
 * the seeded Star Cement tenant. Run: pnpm --filter web e2e a11y.spec.ts
 */

const EMAIL = process.env.DEMO_EMAIL ?? 'harpreet@star-cement.example';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

// axe ruleset scoped to the two levels §13 commits to.
const analyze = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

// The buyer "core flows" — the daily AP path from inbox to payment.
const CORE_FLOWS: Array<{ name: string; path: string }> = [
  { name: 'invoice inbox', path: '/invoices' },
  { name: 'purchase orders', path: '/purchase-orders' },
  { name: 'requisitions', path: '/requisitions' },
  { name: 'payment runs', path: '/payment-runs' },
  { name: 'vendors', path: '/vendors' },
  { name: 'analytics dashboard', path: '/analytics' },
  { name: 'contracts', path: '/contracts' },
];

test.describe('WCAG 2.1 AA — buyer core flows', () => {
  for (const flow of CORE_FLOWS) {
    test(`${flow.name} has no serious/critical axe violations`, async ({ page }) => {
      await login(page);
      await page.goto(flow.path);
      await page.waitForLoadState('networkidle');

      const results = await analyze(page);
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      // Surface the specifics in the failure message rather than a bare count.
      expect(
        blocking,
        blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n'),
      ).toEqual([]);
    });
  }

  test('invoice detail (exception review) has no serious/critical violations', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    const firstRow = page.getByRole('row').nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      const results = await analyze(page);
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        blocking,
        blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n'),
      ).toEqual([]);
    }
  });
});
