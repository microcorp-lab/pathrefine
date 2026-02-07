// Stub module - Color mapping is a PRO feature not available in open source version
import type { Path } from '../types/svg';

export function generateColorMapping(paths: Path[]): Map<string, any> {
  console.warn('Color mapping is a PRO feature. Visit https://pathrefine.dev/ to upgrade.');
  return new Map();
}

export function applyColorMapping(paths: Path[], mapping: Map<string, any>): Path[] {
  return paths;
}

export function extractUniqueColors(svgContent: string): string[] {
  console.warn('Color extraction is a PRO feature. Visit https://pathrefine.dev/ to upgrade.');
  return [];
}

export function generateDefaultVariables(colors: string[]): Record<string, string> {
  return {};
}

export function applyColorMappings(svgContent: string, mappings: Record<string, string>): string {
  return svgContent;
}
