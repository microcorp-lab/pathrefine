/**
 * E2E spec — PRO feature gates (free / open-source build)
 *
 * In the open-source build (`isProVersion: false`), PRO-only UI elements must
 * be absent from the DOM and no premium API calls should be attempted.
 *
 * This spec verifies the _free-tier contract_ — what users can and cannot
 * access — rather than PRO functionality itself.
 *
 * Assertions:
 * - Auto Refine toolbar button is NOT rendered
 * - Auto-Colorize toolbar button is NOT rendered
 * - Export dropdown only contains "Export to SVG" (not Component / Image)
 * - Free features (Smart Heal, Smooth Path) ARE accessible normally
 */
import { test, expect } from '@playwright/test';
import { loadDemo } from './utils';

test.describe('PRO feature gates — free / open-source build', () => {
  // ── Toolbar — absent PRO buttons ─────────────────────────────────────────

  test('Auto Refine toolbar button is NOT present in the DOM', async ({ page }) => {
    await loadDemo(page);
    // The Toolbar renders this button only when hasProFeatures === true
    await expect(page.locator('[title="Auto Refine (Magic Fix)"]')).not.toBeAttached();
  });

  test('Auto-Colorize toolbar button is NOT present in the DOM', async ({ page }) => {
    await loadDemo(page);
    await expect(
      page.locator('[title="Auto-colorize (C) - Replace colors with currentColor [PRO]"]'),
    ).not.toBeAttached();
  });

  // ── Export dropdown — limited to a single free item ──────────────────────

  test('Export dropdown only contains "Export to SVG" in the free build', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /^Export/i }).click();

    // The one free export option must be present
    await expect(page.getByRole('button', { name: 'Export to SVG' })).toBeVisible();

    // PRO export options must be absent
    await expect(page.getByText('Export Component')).not.toBeAttached();
    await expect(page.getByText('Export as Image')).not.toBeAttached();

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  // ── Free features are normally accessible ────────────────────────────────

  test('Smart Heal is visible and accessible in the free build', async ({ page }) => {
    await loadDemo(page);
    const healBtn = page.locator('[title="Smart Heal (Remove 1 point)"]');
    await expect(healBtn).toBeVisible();
    await expect(healBtn).not.toBeDisabled();
  });

  test('Smooth Path is visible and accessible in the free build', async ({ page }) => {
    await loadDemo(page);
    const smoothBtn = page.locator('[title="Smooth Path (S)"]');
    await expect(smoothBtn).toBeVisible();
    await expect(smoothBtn).not.toBeDisabled();
  });

  test('Perfect Square is visible in the free build', async ({ page }) => {
    await loadDemo(page);
    await expect(page.locator('[title^="Perfect Square"]')).toBeVisible();
  });

  // ── No unexpected network calls to the PRO API ───────────────────────────

  test('loading the demo does not make any API calls', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/')) {
        apiRequests.push(req.url());
      }
    });

    await loadDemo(page);
    await page.waitForTimeout(500); // allow any lazy calls to fire

    expect(apiRequests).toHaveLength(0);
  });
});
