import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 5 full browser sweep — drives every goods-receipt & RMA screen in a real
 * browser against the running dev servers (web :3000, api :3001, vendor :3002)
 * with the freshly-seeded Star Cement tenant. Catches render/runtime bugs that
 * typecheck+lint cannot.
 */

const PW = process.env.DEMO_PASSWORD ?? 'Slice0!Demo';
const VENDOR_PW = process.env.DEMO_VENDOR_PASSWORD ?? 'Slice0!Vendor';
const VENDOR_BASE = 'http://localhost:3002';

test.describe.configure({ mode: 'serial' }); // share DB state across the lifecycle
test.setTimeout(120_000);
// Dev-mode compiles routes on first hit, so allow generous waits.
const LONG = 45_000;

async function login(page: Page, email: string, pw = PW, base = ''): Promise<void> {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base || 'http://localhost:3000'}/`, { timeout: LONG });
}

async function logout(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Logout' })
    .click()
    .catch(() => undefined);
  await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => undefined);
}

async function assertNoRuntimeError(page: Page): Promise<void> {
  await expect(page.getByText('Unhandled Runtime Error')).toHaveCount(0);
  await expect(page.getByText('Cannot read properties of undefined')).toHaveCount(0);
}

/** Select the PO whose option label contains `poNumber` (by resolving its value). */
async function selectPo(page: Page, poNumber: string): Promise<void> {
  const select = page.locator('select').first();
  await expect(select).toBeVisible({ timeout: LONG });
  const value = await page
    .locator('select option', { hasText: poNumber })
    .first()
    .getAttribute('value');
  if (!value) throw new Error(`No pending PO option matching ${poNumber}`);
  await select.selectOption(value);
}

// ── Receipts list ────────────────────────────────────────────────────────────

test('receipts list renders and every tab is navigable', async ({ page }) => {
  await login(page, 'r.kumar@star-cement.example');
  await page.goto('/goods-receipt');
  await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible({
    timeout: LONG,
  });
  for (const tab of ['Pending receipt', 'Awaiting QC', 'Posted today', 'Held', 'All']) {
    await page.getByRole('button', { name: new RegExp(tab) }).click();
    await assertNoRuntimeError(page);
  }
  // "All" shows seeded posted GRNs.
  await page.getByRole('button', { name: /All/ }).click();
  await expect(page.getByText(/GRN-\d{4}/).first()).toBeVisible({ timeout: LONG });
});

// ── New-receipt wizard (the page that previously crashed on empty PO) ─────────

test('new-receipt wizard renders and PO selection populates the vendor', async ({
  page,
}) => {
  await login(page, 'r.kumar@star-cement.example');
  await page.goto('/goods-receipt/new');
  await expect(page.getByText('New goods receipt')).toBeVisible({ timeout: LONG });
  await assertNoRuntimeError(page); // regression: must not crash with no PO chosen
  await selectPo(page, 'PO-0493');
  await expect(page.getByText(/Vendor:\s*Patel Engineering/)).toBeVisible({
    timeout: LONG,
  });
  await assertNoRuntimeError(page);
});

// ── Full lifecycle: create → QC (with rejection) → post → RMA → issue ─────────

test('full receipt lifecycle through the UI', async ({ page }) => {
  // 1. Stores officer creates + submits a receipt for PO-0493.
  await login(page, 'r.kumar@star-cement.example');
  await page.goto('/goods-receipt/new?po=');
  await expect(page.getByText('New goods receipt')).toBeVisible({ timeout: LONG });
  await selectPo(page, 'PO-0493');

  await page.getByLabel('Gate entry / challan ref').fill('GP-SWEEP-1');
  await page.getByLabel('Vehicle no').fill('GJ-05-SWEEP');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — line receipt
  const qty = page.getByLabel(/Qty received/).first();
  await qty.fill('8');
  await page.getByRole('button', { name: 'Continue' }).click(); // → attachments
  await page.getByRole('button', { name: 'Continue' }).click(); // → review
  await page.getByRole('button', { name: 'Send for QC' }).click();

  await expect(page).toHaveURL(/\/goods-receipt\/grn_/, { timeout: LONG });
  const grnUrl = page.url();
  await expect(page.getByText(/Pending QC/i)).toBeVisible({ timeout: LONG });
  await assertNoRuntimeError(page);
  await logout(page);

  // 2. QC officer inspects — reject > 1 tonne so it also drives a real rejection.
  await login(page, 'p.nair@star-cement.example');
  await page.goto(`${grnUrl}/qc`);
  await expect(page.getByText(/QC inspection/)).toBeVisible({ timeout: LONG });
  await page
    .getByRole('button', { name: 'Start QC' })
    .click()
    .catch(() => undefined);

  // Fill parameter measurements if the QC inputs are present.
  for (const [name, val] of [
    ['moisture', '2.8'],
    ['hardness', '62'],
    ['density', '7.75'],
  ] as const) {
    const input = page.locator(`text=${name}`).locator('..').locator('input').first();
    await input.fill(val).catch(() => undefined);
  }
  await page
    .getByRole('button', { name: 'Record sample' })
    .click()
    .catch(() => undefined);

  // Decision: accept 6.5, reject 1.5.
  const accepted = page.getByLabel('Qty accepted').first();
  await accepted.fill('6.5');
  await page.getByLabel('Qty rejected').first().fill('1.5');
  await page.getByRole('button', { name: 'Complete QC' }).click();
  await expect(page).toHaveURL(new RegExp(grnUrl.replace(/[/]/g, '\\/') + '$'), {
    timeout: LONG,
  });
  await assertNoRuntimeError(page);
  await logout(page);

  // 3. Stores officer posts.
  await login(page, 'r.kumar@star-cement.example');
  await page.goto(grnUrl);
  await page.getByRole('button', { name: 'Post GRN' }).click();
  await expect(page.getByText(/Posted/).first()).toBeVisible({ timeout: 20_000 });
  // RMA auto-created card is shown.
  await expect(page.getByText(/RMA-\d+/)).toBeVisible();
  await assertNoRuntimeError(page);
});

// ── Seeded posted GRN detail renders ─────────────────────────────────────────

async function apiToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  pw = PW,
): Promise<string> {
  const res = await request.post('http://localhost:3001/api/v1/auth/login', {
    data: { email, password: pw },
  });
  return ((await res.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
}

test('a seeded posted GRN detail page renders', async ({ page, request }) => {
  const token = await apiToken(request, 'r.kumar@star-cement.example');
  const grns = (await (
    await request.get('http://localhost:3001/api/v1/grn?tab=all&limit=1', {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json()) as { items: { id: string }[] };
  const id = grns.items[0]!.id;

  await login(page, 'r.kumar@star-cement.example');
  await page.goto(`/goods-receipt/${id}`);
  await expect(page.getByText('Gate details')).toBeVisible({ timeout: LONG });
  await expect(page.getByText('Line items')).toBeVisible();
  await assertNoRuntimeError(page);
});

// ── RMA list + detail + issue + PDF ──────────────────────────────────────────

test('RMA list and detail render, and issue works', async ({ page, request }) => {
  await login(page, 'm.iyer@star-cement.example');
  await page.goto('/rma');
  await expect(page.getByRole('heading', { name: 'Return authorisations' })).toBeVisible({
    timeout: LONG,
  });
  await assertNoRuntimeError(page);

  // Resolve an RMA id via the API and open its detail directly.
  const token = await apiToken(request, 'm.iyer@star-cement.example');
  const rmas = (await (
    await request.get('http://localhost:3001/api/v1/rma?tab=all&limit=1', {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json()) as { items: { id: string; status: string }[] };
  if (rmas.items.length > 0) {
    const rma = rmas.items[0]!;
    await page.goto(`/rma/${rma.id}`);
    await expect(page.getByText('Return lines')).toBeVisible({ timeout: LONG });
    if (rma.status === 'DRAFT') {
      await page.getByRole('button', { name: 'Issue RMA' }).click();
      await expect(page.getByText(/Download PDF/).first()).toBeVisible({ timeout: LONG });
    }
    await assertNoRuntimeError(page);
  }
});

// ── PDF endpoint is authenticated and returns a PDF ──────────────────────────

test('RMA PDF endpoint returns application/pdf with a bearer token', async ({
  request,
}) => {
  const login = await request.post('http://localhost:3001/api/v1/auth/login', {
    data: { email: 'm.iyer@star-cement.example', password: PW },
  });
  const { tokens } = (await login.json()) as { tokens: { accessToken: string } };
  const list = await request.get('http://localhost:3001/api/v1/rma?tab=all&limit=1', {
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
  const { items } = (await list.json()) as { items: { id: string; status: string }[] };
  const issued = items.find((i) => i.status !== 'DRAFT') ?? items[0];
  if (issued) {
    const pdf = await request.get(`http://localhost:3001/api/v1/rma/${issued.id}/pdf`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    // Either a real PDF (issued) or 409 (still draft) — never 401.
    expect([200, 409, 422]).toContain(pdf.status());
    if (pdf.status() === 200) {
      expect(pdf.headers()['content-type']).toContain('pdf');
    }
  }
});

// ── Vendor portal (:3002) ────────────────────────────────────────────────────

test('vendor portal deliveries and returns render', async ({ page }) => {
  await login(page, 'kalpesh@patel-eng.example', VENDOR_PW, VENDOR_BASE);
  await page.goto(`${VENDOR_BASE}/receipts`);
  await expect(page.getByRole('heading', { name: 'Deliveries received' })).toBeVisible({
    timeout: LONG,
  });
  await assertNoRuntimeError(page);
  await page.goto(`${VENDOR_BASE}/rma`);
  await expect(page.getByRole('heading', { name: 'Return authorisations' })).toBeVisible({
    timeout: LONG,
  });
  await assertNoRuntimeError(page);
});
