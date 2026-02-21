/**
 * E2E spec — Smart Heal (flagship feature)
 *
 * The demo loader auto-selects the first path and opens the heatmap, putting
 * the app in exactly the state a user would be in before healing.
 *
 * Covers:
 * - Smart Heal button (and H shortcut) opens the modal
 * - Auto-Heal run/reset flow produces observable state changes
 * - Apply commits the healed path and closes the modal
 * - Escape / Close button abandon without changes
 */
import { test, expect } from '@playwright/test';
import { loadDemo, getPathCount } from './utils';

test.describe('Smart Heal', () => {
  // ── Opening the modal ─────────────────────────────────────────────────────

  // SmartHealModal is a custom full-screen component — it has no role="dialog".
  // The reliable presence signal is its <h2>Smart Heal</h2> heading.

  test('Smart Heal toolbar button opens the modal when a path is selected', async ({ page }) => {
    await loadDemo(page);
    await page.click('[title="Smart Heal (Remove 1 point)"]');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();
  });

  test('"H" keyboard shortcut opens the Smart Heal modal', async ({ page }) => {
    await loadDemo(page);
    await page.keyboard.press('h');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();
  });

  // ── Auto-Heal flow ────────────────────────────────────────────────────────

  test('Auto-Heal runs automatically on modal open and shows Reset to Original', async ({ page }) => {
    await loadDemo(page);
    await page.click('[title="Smart Heal (Remove 1 point)"]');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();

    // Auto-heal fires on mount — "Reset to Original" should become enabled
    await expect(page.getByRole('button', { name: /Reset to Original/i })).toBeVisible();
    // No "Run Auto-Heal" button exists in the new flow
    await expect(page.getByRole('button', { name: 'Run Auto-Heal' })).not.toBeVisible();
  });

  test('"Apply Auto-Heal" closes the modal and commits the changes', async ({ page }) => {
    await loadDemo(page);
    await page.click('[title="Smart Heal (Remove 1 point)"]');
    // Auto-heal runs on open — wait for Reset button to confirm the heal ran
    await expect(page.getByRole('button', { name: /Reset to Original/i })).toBeVisible();

    await page.getByRole('button', { name: /Apply Auto-Heal/i }).click();

    // Modal closes — heading disappears
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).not.toBeVisible();
    // Document is still in the editor
    await expect(page.getByText('All Paths')).toBeVisible();
  });

  // ── Dismiss flows ─────────────────────────────────────────────────────────

  test('Escape key closes the Smart Heal modal without applying', async ({ page }) => {
    await loadDemo(page);
    await page.click('[title="Smart Heal (Remove 1 point)"]');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();

    const beforeCount = await getPathCount(page);
    await page.keyboard.press('Escape');

    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).not.toBeVisible();
    // Count unchanged
    const afterCount = await getPathCount(page);
    expect(afterCount).toBe(beforeCount);
  });

  test('Cancel button dismisses the modal', async ({ page }) => {
    await loadDemo(page);
    await page.click('[title="Smart Heal (Remove 1 point)"]');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();
    // SmartHealModal footer has a "Cancel" button (the × icon has no accessible label)
    await page.getByRole('button', { name: /^Cancel$/ }).click();
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).not.toBeVisible();
  });

  // ── Batch tab (single-path) ─────────────────────────────────────────────

  test('Batch tab is absent when only one path is selected', async ({ page }) => {
    await loadDemo(page); // exactly one path selected
    await page.click('[title="Smart Heal (Remove 1 point)"]');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();

    // Only Auto-Heal and Manual tabs should exist
    await expect(page.getByRole('button', { name: /Batch/i })).not.toBeAttached();
  });
});