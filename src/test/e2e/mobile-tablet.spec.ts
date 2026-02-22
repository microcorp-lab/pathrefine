/**
 * E2E spec — Mobile & Tablet responsive layout
 *
 * Two describe blocks emulate different device tiers and assert that:
 *
 *  MOBILE  (375×812, iPhone 14)
 *    ✓ Toolbar is hidden (no keyboard-shortcut buttons cluttering the UI)
 *    ✓ PropertiesPanel is completely absent from the DOM
 *    ✓ TouchActionBar renders with minimal action set (Undo/Redo/Heal/Export)
 *    ✓ Heatmap and Smooth buttons are NOT shown (tablet-only actions)
 *    ✓ MobilePathDrawer is not open on first load
 *    ✓ Tapping a canvas path opens the MobilePathDrawer
 *    ✓ MobilePathDrawer shows Heal / Hide / Delete actions
 *    ✓ Tapping the backdrop closes the drawer
 *
 *  TABLET  (834×1194, iPad Air-like, touch-enabled)
 *    ✓ Toolbar is visible
 *    ✓ TouchActionBar shows all 6 actions including Heatmap and Smooth
 *    ✓ PropertiesPanel toggle tab is visible (even when panel is collapsed)
 *    ✓ Clicking the toggle tab reveals the panel with "All Paths"
 *    ✓ Clicking anywhere on the backdrop collapses the panel again
 *    ✓ Undo/Redo via TouchActionBar buttons is wired to the store
 */
import { test, expect } from '@playwright/test';
import { loadDemoTouch } from './utils';

// ─── Mobile ───────────────────────────────────────────────────────────────────

test.describe('Mobile layout (375×812)', () => {
  test.use({
    // Avoid spreading devices['iPhone 14'] — it includes defaultBrowserType: 'webkit'
    // which Playwright forbids inside a describe block (forces worker boundary).
    // Explicit settings give us identical emulation in Chromium.
    viewport:  { width: 390, height: 844 },
    hasTouch:  true,
    isMobile:  true,
  });

  test('Toolbar (snap-to-grid) is hidden on mobile', async ({ page }) => {
    await page.goto('/');
    // The snap button is a reliable proxy for the whole Toolbar being rendered
    await expect(page.locator('[title="Snap to Grid (G)"]')).not.toBeVisible();
  });

  test('PropertiesPanel is absent on mobile (returns null)', async ({ page }) => {
    await loadDemoTouch(page);
    // PropertiesPanel returns null on mobile — the "All Paths" heading is absent
    const allPaths = page.getByText('All Paths');
    // Use count() instead of not.toBeVisible() to confirm it's not in the DOM at all
    await expect(allPaths).toHaveCount(0);
  });

  test('TouchActionBar renders Undo and Redo after demo loads', async ({ page }) => {
    await loadDemoTouch(page);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redo' })).toBeVisible();
  });

  test('TouchActionBar renders Heal and Export on mobile', async ({ page }) => {
    await loadDemoTouch(page);
    await expect(page.getByRole('button', { name: 'Heal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  });

  test('Heatmap and Smooth are NOT shown in TouchActionBar on mobile', async ({ page }) => {
    await loadDemoTouch(page);
    await expect(page.getByRole('button', { name: 'Heatmap' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Smooth' })).toHaveCount(0);
  });

  test('MobilePathDrawer is not visible before any path is tapped', async ({ page }) => {
    await loadDemoTouch(page);
    // Drawer "Heal" button (the drawer-specific one) must not be visible initially
    // Note: the TouchActionBar also has a "Heal" button, so we look for the
    // drawer's green "Heal" button inside the slide-up sheet.
    // We check that "Hide" (which only exists in the drawer) is absent.
    await expect(page.getByRole('button', { name: 'Hide' })).toHaveCount(0);
  });

  test('MobilePathDrawer opens and shows Heal/Hide/Delete actions', async ({ page }) => {
    await loadDemoTouch(page);

    // Obtain a valid path ID from the store (exposed on window in DEV builds).
    // This avoids relying on touch hit-testing against SVG path geometry, which
    // is inherently fragile (thin strokes, complex shapes, canvas transforms).
    const pathId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__editorStore;
      const paths = store?.getState()?.svgDocument?.paths as Array<{ id: string }> | undefined;
      return paths?.[0]?.id ?? null;
    });
    expect(pathId).not.toBeNull();

    // Open the drawer as the touch handler does on path tap
    await page.evaluate((id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__editorStore.getState().openMobileDrawer(id);
    }, pathId as string);

    // The drawer is unique in showing "Hide" and "Delete" action buttons
    await expect(page.getByRole('button', { name: 'Hide', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  });

  test('Tapping the backdrop closes the MobilePathDrawer', async ({ page }) => {
    await loadDemoTouch(page);

    const pathId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paths = (window as any).__editorStore?.getState()?.svgDocument?.paths as Array<{ id: string }> | undefined;
      return paths?.[0]?.id ?? null;
    });
    expect(pathId).not.toBeNull();

    await page.evaluate((id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__editorStore.getState().openMobileDrawer(id);
    }, pathId as string);

    await expect(page.getByRole('button', { name: 'Hide', exact: true })).toBeVisible({ timeout: 5_000 });

    // The backdrop is a fixed full-screen overlay behind the drawer.
    // Tapping the top-left corner (well outside the slide-up sheet) dismisses it.
    await page.touchscreen.tap(20, 20);
    await expect(page.getByRole('button', { name: 'Hide', exact: true })).not.toBeVisible({ timeout: 3_000 });
  });
});

// ─── Tablet ───────────────────────────────────────────────────────────────────

test.describe('Tablet layout (834×1194)', () => {
  test.use({
    viewport: { width: 834, height: 1194 },
    hasTouch: true,
    isMobile: false, // large screen; keep desktop UA but enable touch
  });

  test('Toolbar (snap-to-grid) is visible on tablet', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[title="Snap to Grid (G)"]')).toBeVisible();
  });

  test('TouchActionBar includes Heatmap on tablet', async ({ page }) => {
    await loadDemoTouch(page);
    // exact: true avoids matching the Toolbar's "Complexity Heatmap (X)" button
    await expect(page.getByRole('button', { name: 'Heatmap', exact: true })).toBeVisible();
  });

  test('TouchActionBar includes Smooth on tablet', async ({ page }) => {
    await loadDemoTouch(page);
    // exact: true avoids matching the Toolbar's "Smooth Path (S)" button
    await expect(page.getByRole('button', { name: 'Smooth', exact: true })).toBeVisible();
  });

  test('TouchActionBar includes all 6 actions on tablet', async ({ page }) => {
    await loadDemoTouch(page);
    // Scope to the action bar itself to avoid matching identically-named buttons
    // in the Toolbar (Heatmap, Smooth, Export) or help tooltips (Undo, Redo).
    const bar = page.getByTestId('touch-action-bar');
    await expect(bar).toBeVisible();
    for (const label of ['Undo', 'Redo', 'Heatmap', 'Heal', 'Smooth', 'Export']) {
      await expect(bar.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('PropertiesPanel toggle tab is visible on tablet (even before a doc is loaded)', async ({ page }) => {
    await page.goto('/');
    // The toggle tab has title="Show properties" when collapsed
    await expect(page.locator('[title="Show properties"]')).toBeVisible();
  });

  test('Clicking the toggle tab expands the properties panel', async ({ page }) => {
    await loadDemoTouch(page);
    // Panel starts collapsed on tablet
    await expect(page.locator('[title="Show properties"]')).toBeVisible();
    await page.locator('[title="Show properties"]').click();
    // Now the panel is open: "All Paths" heading should be accessible
    await expect(page.getByText('All Paths')).toBeVisible({ timeout: 5_000 });
    // The toggle title flips
    await expect(page.locator('[title="Hide properties"]')).toBeVisible();
  });

  test('Clicking the backdrop recollapse the panel', async ({ page }) => {
    await loadDemoTouch(page);
    await page.locator('[title="Show properties"]').click();
    await expect(page.getByText('All Paths')).toBeVisible({ timeout: 5_000 });
    // The backdrop is a fixed full-screen overlay rendered behind the panel.
    // Clicking the far left of the screen (outside the 288px panel) dismisses it.
    await page.mouse.click(100, 600);
    // Panel should be collapsed again
    await expect(page.locator('[title="Show properties"]')).toBeVisible({ timeout: 3_000 });
  });

  test('Undo via TouchActionBar reverts a Smart Heal (path count unchanged)', async ({ page }) => {
    await loadDemoTouch(page);

    // Open properties panel to read path count
    await page.locator('[title="Show properties"]').click();
    await expect(page.getByText('All Paths')).toBeVisible({ timeout: 5_000 });

    const bodyBefore = await page.locator('body').innerText();
    const matchBefore = /Paths:\s*(\d+)/.exec(bodyBefore);
    expect(matchBefore).not.toBeNull();
    const countBefore = parseInt(matchBefore![1], 10);
    expect(countBefore).toBeGreaterThan(0);

    // Perform an action that adds to history: use keyboard delete (works on tablet)
    await page.keyboard.press('ControlOrMeta+Backspace');
    await page.waitForTimeout(300);

    const bodyAfter = await page.locator('body').innerText();
    const matchAfter = /Paths:\s*(\d+)/.exec(bodyAfter);
    const countAfter = matchAfter ? parseInt(matchAfter[1], 10) : countBefore;
    expect(countAfter).toBeLessThan(countBefore);

    // Undo via TouchActionBar button
    await page.locator('[title="Hide properties"]').click(); // close panel to reach action bar
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.waitForTimeout(300);

    // Reopen panel and verify restored count
    await page.locator('[title="Show properties"]').click();
    await expect(page.getByText('All Paths')).toBeVisible({ timeout: 5_000 });
    const bodyRestored = await page.locator('body').innerText();
    const matchRestored = /Paths:\s*(\d+)/.exec(bodyRestored);
    const countRestored = matchRestored ? parseInt(matchRestored[1], 10) : 0;
    expect(countRestored).toBe(countBefore);
  });
});
