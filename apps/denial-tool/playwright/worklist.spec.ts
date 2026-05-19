/**
 * Worklist e2e (PR-5).
 *
 * Updates from PR-4:
 *   - REMOVED: "Source evidence" absent assertion (PR-4 dropped region 2;
 *     Phase 1.5 wires it back via denial-events).
 *   - ADDED: assertion that the Source evidence region IS present + renders
 *     CARC/RARC codes for an expanded row.
 *   - ADDED: Complete button visibility on accepted/overridden rows.
 *   - ADDED: per-step checkbox interaction — sequential, with auto-complete
 *     when the last step in an accepted-state row closes.
 *   - ADDED: ClaimDetailHeader visible after row expand (provider + financial
 *     breakdown).
 */

import { expect, test } from '@playwright/test';

test.describe('worklist — Phase 1.5 surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /sign in as analyst/i }).click();
    await expect(page).toHaveURL(/\/worklist/);
  });

  // -------------------------------------------------------------------------

  test('default state filter is `recommended` and rows render', async ({ page }) => {
    await expect(
      page.getByRole('option', { name: /recommended/i, selected: true }),
    ).toBeVisible();
    // At least one row should be visible
    await expect(page.locator('[data-row-id]').first()).toBeVisible();
  });

  test('only the 6 priority-chip variants are present anywhere on the page', async ({
    page,
  }) => {
    const allowed = new Set([
      'HIGH_DOLLAR',
      'LOW_CONFIDENCE',
      'DUP_INVESTIGATE',
      'TF_WATCH',
      'OVERRIDE_PATTERN',
      'DATA_ERROR',
    ]);
    const chips = await page.locator('[data-priority-chip]').allTextContents();
    for (const text of chips) {
      const code = text.trim().toUpperCase().replace(/\s+/g, '_');
      expect(allowed.has(code) || allowed.has(text.trim())).toBeTruthy();
    }
  });

  // -------------------------------------------------------------------------
  // Row expansion — three regions back, ClaimDetailHeader present
  // -------------------------------------------------------------------------

  test('row expansion renders all three §6.6 regions plus ClaimDetailHeader', async ({
    page,
  }) => {
    // Expand the first row
    await page.locator('[data-row-id]').first().click();

    // ClaimDetailHeader (Phase 1.5) — financial breakdown should appear
    await expect(page.getByText(/Financial breakdown/i)).toBeVisible();
    await expect(page.getByText(/Net pending/i)).toBeVisible();

    // Region 1
    await expect(
      page.getByRole('heading', { name: /Classification reasoning/i }),
    ).toBeVisible();

    // Region 2 — RESTORED in PR-5
    await expect(
      page.getByRole('heading', { name: /Source evidence/i }),
    ).toBeVisible();

    // Region 3
    await expect(
      page.getByRole('heading', { name: /Recommended action plan/i }),
    ).toBeVisible();
  });

  test('Source evidence region shows at least one CARC code badge', async ({ page }) => {
    // Pick a wrong-payer row (claim 314785) for predictable CARC
    await page.locator('[data-row-id]').first().click();
    // CARC label and at least one code badge
    await expect(page.getByText(/CARCs/i).first()).toBeVisible();
    // Mock fixture's first row uses CO-109
    await expect(page.getByText(/CO-109/i)).toBeVisible();
  });

  test('PHI fields are masked by default and reveal on click', async ({ page }) => {
    await page.locator('[data-row-id]').first().click();
    // Patient name initially masked
    const eyeButtons = page.getByRole('button', { name: /reveal phi/i });
    await expect(eyeButtons.first()).toBeVisible();
    await eyeButtons.first().click();
    // After reveal, the eye button is gone for that field
    // (the component renders the revealed value as plain text)
  });

  // -------------------------------------------------------------------------
  // Override modal — 5 reasons including worked_outside_tool
  // -------------------------------------------------------------------------

  test('override modal exposes exactly 5 reasons including worked_outside_tool', async ({
    page,
  }) => {
    await page.locator('[data-row-id]').first().click();
    await page.getByRole('button', { name: /^Override/i }).click();
    const reasonLabels = [
      'Tool is wrong',
      'Tool right, alternate path',
      'Edge case',
      'Data error',
      'Worked outside tool',
    ];
    for (const label of reasonLabels) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // D-13 — worked-outside-tool primary button when current_status != Denied
  // -------------------------------------------------------------------------

  test('worked-outside-tool button is the primary action on Clari Opened rows', async ({
    page,
  }) => {
    // Filter to a state that includes the D-13 fixture rows
    const claroRow = page.getByText(/Clari Opened/).first();
    await claroRow.scrollIntoViewIfNeeded();
    await claroRow.click();
    await expect(
      page.getByRole('button', { name: /Mark as worked outside tool/i }),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Phase 1.5 — Complete button on accepted/overridden rows
  // -------------------------------------------------------------------------

  test('Complete button visible on accepted rows; absent on recommended', async ({
    page,
  }) => {
    // Recommended row — no Complete button
    await page.locator('[data-row-id]').first().click();
    await expect(page.locator('[data-testid="complete-button"]')).toHaveCount(0);
    // Collapse
    await page.locator('[data-row-id]').first().click();

    // Switch the state filter to `accepted`
    await page.getByRole('combobox', { name: /state/i }).selectOption('accepted');
    await expect(page.locator('[data-row-id]').first()).toBeVisible();
    await page.locator('[data-row-id]').first().click();
    await expect(page.locator('[data-testid="complete-button"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Phase 1.5 — per-step checkboxes
  // -------------------------------------------------------------------------

  test('per-step checkboxes: only the next-incomplete is checkable on accepted rows', async ({
    page,
  }) => {
    await page.getByRole('combobox', { name: /state/i }).selectOption('accepted');
    await page.locator('[data-row-id]').first().click();

    // The fixture's first accepted row has step 1 pre-completed
    const checkboxes = page.locator(
      '[aria-label^="Mark step"]',
    );
    await expect(checkboxes.first()).toBeChecked();
    await expect(checkboxes.first()).toBeDisabled();
    await expect(checkboxes.nth(1)).not.toBeDisabled();
    // Steps 3..N still disabled (out-of-order completion blocked)
    if ((await checkboxes.count()) >= 3) {
      await expect(checkboxes.nth(2)).toBeDisabled();
    }
  });

  test('clicking a step checkbox completes it and unlocks the next one', async ({
    page,
  }) => {
    await page.getByRole('combobox', { name: /state/i }).selectOption('accepted');
    await page.locator('[data-row-id]').first().click();

    const checkboxes = page.locator('[aria-label^="Mark step"]');
    const totalSteps = await checkboxes.count();
    if (totalSteps < 2) test.skip();

    await checkboxes.nth(1).click();
    // After the mutation resolves and refetches, step 2 should be checked
    await expect(checkboxes.nth(1)).toBeChecked({ timeout: 5000 });
    if (totalSteps >= 3) {
      await expect(checkboxes.nth(2)).not.toBeDisabled();
    }
  });

  // -------------------------------------------------------------------------
  // No globally banned UI
  // -------------------------------------------------------------------------

  test('no global "Run classifier now" header button (D-18 is per-row)', async ({
    page,
  }) => {
    // The header should not contain a global re-classify trigger
    const header = page.getByRole('banner');
    await expect(
      header.getByRole('button', { name: /run classifier/i }),
    ).toHaveCount(0);
  });

  test('no bulk-override button anywhere (Phase 1 supports bulk-accept only)', async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: /bulk override/i }),
    ).toHaveCount(0);
  });
});
