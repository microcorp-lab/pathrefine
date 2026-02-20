/**
 * Shared E2E test helpers for PathRefine Playwright specs.
 *
 * These live alongside the spec files in `src/test/e2e/` so they are
 * local imports, not subject to Vitest's module resolution.
 */
import { type Page, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the SVG fixtures directory */
export const FIXTURES_DIR = path.join(__dirname, '../fixtures');

/**
 * Navigate to the app root, click the "Fix Broken Logo" demo card and wait
 * until the PropertiesPanel shows the loaded document's path list.
 *
 * The demo is the easiest way to load content in E2E tests because it needs
 * no file-system access — the SVG data is embedded in the bundle.
 */
export async function loadDemo(page: Page): Promise<void> {
  // In core/ the EditorView is served at the root path
  await page.goto('/');
  // Click the demo card (the heading text is the most stable selector)
  await page.getByText('Fix Broken Logo').click();
  // Wait for properties panel to confirm the document was parsed
  await expect(page.getByText('All Paths')).toBeVisible({ timeout: 10_000 });
  // The demo card's selectPath() fires inside a 100ms setTimeout; the Smart Heal
  // button is disabled until selectedPathIds.length > 0, so wait for it to be enabled
  // as a reliable signal that a path is selected and shortcuts will fire.
  await expect(page.locator('[title="Smart Heal (Remove 1 point)"]')).not.toBeDisabled({ timeout: 5_000 });
}

/**
 * Upload an SVG fixture file via the "Upload SVG" button, which triggers a
 * native file-chooser dialog that Playwright can intercept.
 */
export async function uploadSVGFixture(page: Page, filename: string): Promise<void> {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Upload SVG/i }).click(),
  ]);
  await fileChooser.setFiles(path.join(FIXTURES_DIR, filename));
  // Wait for the document to appear in the PropertiesPanel
  await expect(page.getByText('All Paths')).toBeVisible({ timeout: 10_000 });
}

/**
 * Read the numeric path count shown in the PropertiesPanel ("Paths: N").
 * Returns 0 if the value cannot be found.
 */
export async function getPathCount(page: Page): Promise<number> {
  // Locate the element that contains "Paths:" and get the sibling value
  const bodyText = await page.locator('body').innerText();
  const match = /Paths:\s*(\d+)/.exec(bodyText);
  return match ? parseInt(match[1], 10) : 0;
}
