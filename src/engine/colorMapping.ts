// Stub module - Color mapping is a PRO feature not available in open source version
import type { SVGDocument } from '../types/svg';
import type { ColorMapping } from '../components/AutoColorizePanel';

export function extractUniqueColors(_document: SVGDocument): Map<string, number> {
  console.warn('Color extraction is a PRO feature. Visit https://pathrefine.dev/ to upgrade.');
  return new Map();
}

export function generateDefaultVariables(_colors: Map<string, number>): ColorMapping[] {
  return [];
}

export function applyColorMappings(
  document: SVGDocument,
  _colorMappings: ColorMapping[],
  _useCssVariables: boolean,
  _selectedPathIds: string[] = []
): SVGDocument {
  console.warn('Color mapping is a PRO feature. Visit https://pathrefine.dev/ to upgrade.');
  return document;
}
