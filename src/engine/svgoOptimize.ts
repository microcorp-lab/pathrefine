/**
 * SVGO post-processing for PathRefine exports
 *
 * Pipeline:  Raw SVG → PathRefine (geometry) → applySvgo (formatting) → export
 *
 * PathRefine owns the geometry (merge paths, simplify curves).
 * SVGO owns the formatting (strip whitespace, relative coords, precision, etc.).
 * The two are complementary — SVGO's mergePaths and removeViewBox are disabled
 * so we don't undo PathRefine's structural work.
 */

// Use the browser-safe SVGO bundle (no Node.js-specific APIs)
import { optimize } from 'svgo/browser';

/**
 * Apply SVGO post-processing to a serialized SVG string.
 *
 * Covers all of the former Tasks 6–10 (minification, strip IDs, space-only
 * coord separators, viewBox reduction, trailing zero removal) plus ~15 more
 * optimisations from SVGO's preset-default.
 *
 * Always returns a valid SVG string. On error, returns the original untouched.
 */
export function applySvgo(svgString: string): string {
  try {
    const result = optimize(svgString, {
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              // PathRefine already does better path merging (color-aware, curve-fitting)
              // — SVGO's simpler heuristic would undo that work.
              mergePaths: false,
              // Always preserve viewBox — the user set dimensions intentionally.
              removeViewBox: false,
            },
          },
        },
        // Strip id= attributes — PathRefine uses them internally for selection
        // and undo history, but they're noise in the exported file.
        { name: 'cleanupIds' },
      ],
    });
    return result.data;
  } catch (err) {
    console.warn('[PathRefine] SVGO optimization failed, exporting unoptimized SVG:', err);
    return svgString;
  }
}

/** Format a byte count as a human-readable string: "1.4 KB" or "892 B" */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Return the UTF-8 byte size of a string (matches what the browser downloads) */
export function svgByteSize(svgString: string): number {
  return new TextEncoder().encode(svgString).length;
}
