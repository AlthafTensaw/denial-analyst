/**
 * Worklist Playwright spec — PR-4 update.
 *
 * Key changes from PR-3:
 *   - Row selectors target data-row-id with UUID strings, not integers.
 *   - Cell selectors look for state field (was: status).
 *   - Chip text-matching uses the 6-value set (no DUP_OF_EARLIER etc).
 *   - Override modal asserts 5 reasons including "Worked outside tool".
 *   - No bulk-override button — assert it's absent.
 */

import { expect, test } from '@playwright/test';

test.describe('Denial Tool worklist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.selectOption('select', 'ANALYST');
    await page.getByRole('button', { name: /Sign in as ANALYST/ }).click();
    await page.waitForURL('**/worklist');
  });

  test('loads with default state=recommended filter', async ({ page }) => {
    // Default filter pre-selects state=recommended; row count > 0.
    const rows = page.locator('[data-row-id]');
    await expect(rows).toHaveCount(50, { timeout: 5000 });
  });

  test('priority chips render with the 6-value set', async ({ page }) => {
    const allowed = [
      'TF watch',
      'High $',
      'Low conf',
      'Dup — investigate',
      'Override pattern',
      'Data error',
    ];
    const chipsText = await page
      .locator('[data-row-id] span[title]')
      .allTextContents();
    const seen = new Set(chipsText.map((s) => s.trim()).filter(Boolean));
    for (const chip of seen) {
      expect(allowed).toContain(chip);
    }
  });

  test('row expansion shows two regions (no source-evidence region)', async ({
    page,
  }) => {
    const firstRow = page.locator('[data-row-id]').first();
    await firstRow.click();
    await expect(
      page.getByText('Classification reasoning'),
    ).toBeVisible();
    await expect(
      page.getByText('Recommended action plan'),
    ).toBeVisible();
    // Region 2 (source evidence) was dropped in PR-4 — assert absent.
    await expect(page.getByText('Source evidence')).toHaveCount(0);
  });

  test('worked-outside-tool button appears for non-Denied current status', async ({
    page,
  }) => {
    // Filter to recommended only (default), find a row with a current_status_label badge.
    // The fixture has 5 rows with current_status_label != Denied (Clari Opened, Clari Closed, Filed, Pat Balance, Closed).
    const badge = page
      .getByText('Clari Opened', { exact: true })
      .first();
    await badge.scrollIntoViewIfNeeded();
    const row = page.locator(
      `[data-row-id]:has-text("Clari Opened")`,
    ).first();
    await row.click();
    await expect(
      page.getByRole('button', { name: /Mark as worked outside tool/ }),
    ).toBeVisible();
  });

  test('override modal shows 5 reasons including worked_outside_tool', async ({
    page,
  }) => {
    const firstRow = page.locator('[data-row-id]').first();
    await firstRow.click();
    await page.getByRole('button', { name: /Override…/ }).click();
    await expect(page.getByText('Tool is wrong')).toBeVisible();
    await expect(
      page.getByText('Tool right, alternate path'),
    ).toBeVisible();
    await expect(page.getByText('Edge case')).toBeVisible();
    await expect(page.getByText('Data error')).toBeVisible();
    await expect(page.getByText('Worked outside tool')).toBeVisible();
  });

  test('no Bulk Override button in selection bar', async ({ page }) => {
    // Select a row
    const firstCheckbox = page
      .locator('[data-row-id] input[type="checkbox"]')
      .first();
    await firstCheckbox.check();
    // Assert: bulk-override button does NOT exist.
    await expect(
      page.getByRole('button', { name: /Bulk override/ }),
    ).toHaveCount(0);
    // But Export csv (client-side now) is present.
    await expect(
      page.getByRole('button', { name: /Export csv/ }),
    ).toBeVisible();
  });

  test('D-19 bulk-accept enabled only for all-high + recommended + not flagged', async ({
    page,
  }) => {
    // Select two known-high rows (1001, 1002 in the fixture are both high confidence)
    const checkboxes = page.locator(
      '[data-row-id] input[type="checkbox"]',
    );
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    const acceptAll = page.getByRole('button', { name: 'Accept all' });
    await expect(acceptAll).toBeEnabled();
  });

  test('no global "Run classifier now" header button', async ({ page }) => {
    // PR-4 restricts re-classify to per-claim row context. Top-level
    // header should not expose it.
    await expect(
      page
        .locator('header')
        .getByRole('button', { name: /Run classifier/i }),
    ).toHaveCount(0);
  });
});
