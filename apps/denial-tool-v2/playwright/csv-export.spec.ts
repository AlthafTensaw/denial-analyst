/**
 * CSV export Playwright spec — PR-4 rewrite for client-side CSV.
 *
 * PR-3.1 tested round-tripped bytes from POST /v1/worklist/export.
 * That endpoint is gone; CSV is now built in-memory from the selected
 * rows. We assert on the downloaded file contents instead.
 *
 * Watermark format preserved verbatim from PR-3.1.
 */

import { expect, test } from '@playwright/test';

test.describe('Client-side CSV export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.selectOption('select', 'ANALYST');
    await page.getByRole('button', { name: /Sign in as ANALYST/ }).click();
    await page.waitForURL('**/worklist');
  });

  test('Export csv downloads watermarked CSV of selected rows', async ({
    page,
  }) => {
    // Select 3 rows
    const checkboxes = page.locator(
      '[data-row-id] input[type="checkbox"]',
    );
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export csv/ }).click(),
    ]);

    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(path!, 'utf-8');

    // Watermark header
    expect(content).toMatch(
      /^# Tensaw Denial Tool — Worklist export/m,
    );
    expect(content).toMatch(/^# Generated: /m);
    expect(content).toMatch(/^# User: /m);
    expect(content).toMatch(/^# Row count: 3$/m);

    // Schema columns
    const lines = content.split('\n').filter((l) => !l.startsWith('#'));
    const header = lines[0]!;
    for (const col of [
      'classification_id',
      'claim_id',
      'state',
      'primary_category',
      'confidence',
      'priority_chips',
      'recommended_owner',
      'sla_next_action_date',
      'payer',
      'amount',
      'net_pending',
      'dos',
      'aging_bucket',
      'current_status_label',
    ]) {
      expect(header).toContain(col);
    }

    // 3 data rows
    const dataRows = lines.slice(1).filter((l) => l.trim().length > 0);
    expect(dataRows).toHaveLength(3);

    // Each data row's classification_id should be a UUID
    for (const row of dataRows) {
      expect(row).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      );
    }
  });

  test('Filename is stamped with user + ISO timestamp', async ({ page }) => {
    const checkbox = page
      .locator('[data-row-id] input[type="checkbox"]')
      .first();
    await checkbox.check();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export csv/ }).click(),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(
      /^denial-worklist-analyst_primrose\.dev-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/,
    );
  });
});
