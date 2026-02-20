/**
 * E2E spec — Keyboard shortcuts
 *
 * Verifies that single-key and modifier-key shortcuts fire the intended editor
 * actions without side-effects.  All shortcuts are handled on `window` in
 * EditorView, guarded by `shouldIgnoreKeyboardShortcut` (not fired when focus
 * is inside an input/textarea).
 *
 * Shortcuts tested:
 *   H            → Smart Heal modal
 *   S            → Smooth Path modal
 *   Ctrl/⌘+Z    → Undo last change
 *   Ctrl/⌘+⌫   → Delete selected path(s)
 *   G            → Toggle snap-to-grid
 *   X            → Toggle complexity heatmap
 *   Escape       → Close any open modal
 */
import { test, expect } from '@playwright/test';
import { loadDemo, getPathCount } from './utils';

// Playwright resolves Meta on macOS and Ctrl on Windows/Linux automatically
// when using `ControlOrMeta`.
const MODIFIER = 'ControlOrMeta';

test.describe('Keyboard shortcuts', () => {
  // ── Modal-opening shortcuts ───────────────────────────────────────────────

  test('H opens the Smart Heal modal', async ({ page }) => {
    await loadDemo(page);
    await page.keyboard.press('h');
    // SmartHealModal has no role="dialog" — detect by its <h2> heading
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();
  });

  test('S opens the Smooth Path modal', async ({ page }) => {
    await loadDemo(page);
    await page.keyboard.press('s');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('Escape closes an open modal', async ({ page }) => {
    await loadDemo(page);
    await page.keyboard.press('h');
    // SmartHealModal has no role="dialog" — detect by its <h2> heading
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /^Smart Heal$/ })).not.toBeVisible();
  });

  // ── Delete and Undo ──────────────────────────────────────────────────────

  test('Cmd/Ctrl+Backspace deletes the selected path', async ({ page }) => {
    await loadDemo(page);
    const before = await getPathCount(page);
    expect(before).toBeGreaterThan(0);

    await page.keyboard.press(`${MODIFIER}+Backspace`);
    await page.waitForTimeout(400); // allow React re-render

    const after = await getPathCount(page);
    expect(after).toBeLessThan(before);
  });

  test('Cmd/Ctrl+Z undoes a path deletion', async ({ page }) => {
    await loadDemo(page);
    const initial = await getPathCount(page);

    // Delete
    await page.keyboard.press(`${MODIFIER}+Backspace`);
    await page.waitForTimeout(300);
    const afterDelete = await getPathCount(page);
    expect(afterDelete).toBeLessThan(initial);

    // Undo
    await page.keyboard.press(`${MODIFIER}+z`);
    await page.waitForTimeout(300);
    const afterUndo = await getPathCount(page);
    expect(afterUndo).toBe(initial);
  });

  // ── Toggle shortcuts ──────────────────────────────────────────────────────

  test('G key fires without error (snap-to-grid toggle)', async ({ page }) => {
    await loadDemo(page);
    // The snap button has title="Snap to Grid (G)".
    // We verify the button exists and the app doesn't crash after pressing G.
    await expect(page.locator('[title="Snap to Grid (G)"]')).toBeVisible();
    await page.keyboard.press('g');
    await page.waitForTimeout(200);
    // App is still healthy: All Paths section is still visible
    await expect(page.getByText('All Paths')).toBeVisible();
  });

  test('X key fires without error (heatmap toggle)', async ({ page }) => {
    await loadDemo(page);
    await expect(page.locator('[title="Complexity Heatmap (X)"]')).toBeVisible();
    await page.keyboard.press('x');
    await page.waitForTimeout(200);
    await expect(page.getByText('All Paths')).toBeVisible();
  });
});
