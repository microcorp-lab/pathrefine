/**
 * E2E spec — Load SVG and Export
 *
 * Covers the primary user workflow:
 * 1. App loads and shows the empty-state landing card
 * 2. Clicking the demo card loads a document and populates the editor
 * 3. Properties panel reflects the loaded document (path count, dimensions)
 * 4. Export dropdown → "Export to SVG" opens the two-step export modal
 * 5. The modal's step navigation works (Step 1 → Step 2)
 */
import { test, expect } from '@playwright/test';
import { loadDemo } from './utils';

test.describe('Load SVG and Export', () => {
  // ── Empty state ──────────────────────────────────────────────────────────

  test('shows the demo card before any document is loaded', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Fix Broken Logo')).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload SVG/i })).toBeVisible();
  });

  // ── Demo loading ─────────────────────────────────────────────────────────

  test('clicking the demo card loads a document', async ({ page }) => {
    await loadDemo(page);
    // Properties panel confirms the document is present
    await expect(page.getByText('All Paths')).toBeVisible();
    await expect(page.getByText('Paths:')).toBeVisible();
  });

  test('properties panel shows positive path count after demo loads', async ({ page }) => {
    await loadDemo(page);
    // The path count is rendered as a sibling of "Paths:" — check it's not 0
    const bodyText = await page.locator('body').innerText();
    const match = /Paths:\s*(\d+)/.exec(bodyText);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThan(0);
  });

  test('properties panel shows Width and Height after demo loads', async ({ page }) => {
    await loadDemo(page);
    await expect(page.getByText('Width:')).toBeVisible();
    await expect(page.getByText('Height:')).toBeVisible();
  });

  // ── Export modal ─────────────────────────────────────────────────────────

  test('Export dropdown button is visible after document loads', async ({ page }) => {
    await loadDemo(page);
    await expect(page.getByRole('button', { name: /^Export/i })).toBeVisible();
  });

  test('"Export to SVG" opens the export modal', async ({ page }) => {
    await loadDemo(page);
    // Open the Export dropdown
    await page.getByRole('button', { name: /^Export/i }).click();
    // Click the "Export to SVG" item in the dropdown list
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    // The modal should be present with proper ARIA role
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  test('export modal step 1 shows a "Next" button', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /^Export/i }).click();
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    await expect(page.getByRole('button', { name: /Next/i })).toBeVisible();
    // Step 2 button should NOT be visible yet
    await expect(page.getByRole('button', { name: /Download SVG/i })).not.toBeVisible();
  });

  test('clicking "Next" advances to step 2 with a "Download SVG" button', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /^Export/i }).click();
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByRole('button', { name: /Download SVG/i })).toBeVisible();
  });

  test('export modal closes on Escape', async ({ page }) => {
    await loadDemo(page);
    await page.getByRole('button', { name: /^Export/i }).click();
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
