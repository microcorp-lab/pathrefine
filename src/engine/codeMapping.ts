/**
 * Code Mapping System for Bi-Directional Canvas-Code Sync
 * 
 * This module creates a mapping between:
 * - SVG elements (paths) and their position in the code (line numbers, character ranges)
 * - Path data points and their position within the `d` attribute
 */

import type { SVGDocument, Path } from '../types/svg';

export interface CodePosition {
  line: number;        // 1-based line number
  column: number;      // 1-based column number
  offset: number;      // 0-based character offset from start of document
}

export interface CodeRange {
  start: CodePosition;
  end: CodePosition;
}

export interface PathCodeMapping {
  pathId: string;
  elementRange: CodeRange;      // Full <path> element range
  idRange?: CodeRange;          // id attribute range
  dRange?: CodeRange;           // d attribute range
  fillRange?: CodeRange;        // fill attribute range
  strokeRange?: CodeRange;      // stroke attribute range
  
  // Point-level mappings (for paths with formatted d attribute)
  pointMappings?: PointCodeMapping[];
}

export interface PointCodeMapping {
  pointIndex: number;      // Index in the path's control points array
  commandType: string;     // M, L, C, Q, Z, etc.
  commandRange: CodeRange; // Range of the command in the d attribute
  isSelected?: boolean;    // Whether this point is currently selected
}

export interface CodeMappingResult {
  code: string;                        // The generated SVG code
  mappings: Map<string, PathCodeMapping>; // pathId -> mapping
  totalLines: number;                  // Total line count
}

/**
 * Generate formatted SVG code with character position mappings
 */
export function generateSVGCodeWithMappings(svgDocument: SVGDocument | null): CodeMappingResult {
  const mappings = new Map<string, PathCodeMapping>();
  
  if (!svgDocument) {
    return {
      code: '<!-- No SVG loaded -->',
      mappings,
      totalLines: 1,
    };
  }

  let code = '';
  let line = 1;
  let column = 1;
  let offset = 0;

  const addText = (text: string): void => {
    code += text;
    for (const char of text) {
      if (char === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
      offset++;
    }
  };

  const getCurrentPosition = (): CodePosition => ({ line, column, offset });

  // SVG opening tag
  const viewBox = svgDocument.viewBox;
  const viewBoxAttr = viewBox 
    ? ` viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"`
    : '';
  
  addText(`<svg width="${svgDocument.width}" height="${svgDocument.height}"${viewBoxAttr} xmlns="http://www.w3.org/2000/svg">\n`);

  // Process each path
  svgDocument.paths.forEach(path => {
    // Skip hidden paths
    if (path.visible === false) return;

    const pathMapping: PathCodeMapping = {
      pathId: path.id,
      elementRange: {
        start: getCurrentPosition(),
        end: getCurrentPosition(), // Will update at the end
      },
    };

    // Start <path> tag
    addText('  <path\n');

    // id attribute
    addText('    id="');
    const idStart = getCurrentPosition();
    addText(path.id);
    const idEnd = getCurrentPosition();
    pathMapping.idRange = { start: idStart, end: idEnd };
    addText('"\n');

    // d attribute (with point-level mappings for control points)
    addText('    d="');
    const dStart = getCurrentPosition();
    
    // Generate point mappings based on control points
    // Build the d attribute string while tracking positions
    const pointMappings: PointCodeMapping[] = [];
    let controlPointIndex = 0;
    
    path.segments.forEach((segment, segmentIndex) => {
      // For first segment only, the start point is controlPointIndex 0
      if (segmentIndex === 0) {
        controlPointIndex++; // Move past the first anchor point
      }
      
      // Record position before adding this segment's text
      const commandStart: CodePosition = getCurrentPosition();
      
      // Add segment type
      addText(segment.type);
      
      // Add segment points
      if (segment.points.length > 0) {
        addText(' ');
        segment.points.forEach((point, idx) => {
          // Skip invalid points
          if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || 
              isNaN(point.x) || isNaN(point.y) || !isFinite(point.x) || !isFinite(point.y)) {
            console.warn('[CodeMapping] Skipping invalid point:', point);
            return;
          }
          if (idx > 0) addText(' ');
          addText(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
        });
      }
      
      // Add end point (for commands that have it and it's not already in points)
      // M and L segments already have their target point in the 'points' array
      // C and Q segments only have control points in their 'points' array
      if (segment.type === 'C' || segment.type === 'Q') {
        addText(` ${segment.end.x.toFixed(2)},${segment.end.y.toFixed(2)}`);
      }
      
      // Record position after adding this segment
      const commandEnd: CodePosition = getCurrentPosition();
      
      // Add space before next command (except for last segment)
      if (segmentIndex < path.segments.length - 1) {
        addText(' ');
      }
      
      // Map each control point and end anchor in this segment
      const numControlPoints = segment.type === 'C' ? 2 : segment.type === 'Q' ? 1 : 0;
      
      // Add mappings for control points
      for (let i = 0; i < numControlPoints; i++) {
        pointMappings.push({
          pointIndex: controlPointIndex++,
          commandType: segment.type,
          commandRange: { start: commandStart, end: commandEnd }
        });
      }
      
      // Add mapping for end anchor point (if not Z command)
      if (segment.type !== 'Z') {
        pointMappings.push({
          pointIndex: controlPointIndex++,
          commandType: segment.type,
          commandRange: { start: commandStart, end: commandEnd }
        });
      }
    });

    const dEnd = getCurrentPosition();
    pathMapping.dRange = { start: dStart, end: dEnd };
    pathMapping.pointMappings = pointMappings;
    addText('"\n');

    // fill attribute
    if (path.fill) {
      addText('    fill="');
      const fillStart = getCurrentPosition();
      addText(path.fill);
      const fillEnd = getCurrentPosition();
      pathMapping.fillRange = { start: fillStart, end: fillEnd };
      addText('"\n');
    }

    // stroke attribute
    if (path.stroke) {
      addText('    stroke="');
      const strokeStart = getCurrentPosition();
      addText(path.stroke);
      const strokeEnd = getCurrentPosition();
      pathMapping.strokeRange = { start: strokeStart, end: strokeEnd };
      addText('"\n');
    }

    // strokeWidth attribute
    if (path.strokeWidth) {
      addText(`    stroke-width="${path.strokeWidth}"\n`);
    }

    // transform attribute
    if (path.transform?.raw) {
      addText(`    transform="${path.transform.raw}"\n`);
    }

    // Close path tag
    addText('  />\n');

    // Update element end position
    pathMapping.elementRange.end = getCurrentPosition();

    mappings.set(path.id, pathMapping);
  });

  // Close SVG tag
  addText('</svg>');

  return {
    code,
    mappings,
    totalLines: line,
  };
}

/**
 * Find which path a given line number belongs to
 */
export function findPathAtLine(
  mappings: Map<string, PathCodeMapping>,
  lineNumber: number
): PathCodeMapping | null {
  for (const mapping of mappings.values()) {
    if (
      lineNumber >= mapping.elementRange.start.line &&
      lineNumber <= mapping.elementRange.end.line
    ) {
      return mapping;
    }
  }
  return null;
}

/**
 * Find which path a given character offset belongs to
 */
export function findPathAtOffset(
  mappings: Map<string, PathCodeMapping>,
  offset: number
): PathCodeMapping | null {
  for (const mapping of mappings.values()) {
    if (
      offset >= mapping.elementRange.start.offset &&
      offset <= mapping.elementRange.end.offset
    ) {
      return mapping;
    }
  }
  return null;
}

/**
 * Check if a line/column position is within a specific attribute
 */
export function getAttributeAtPosition(
  mapping: PathCodeMapping,
  line: number,
  column: number
): 'id' | 'd' | 'fill' | 'stroke' | null {
  const offset = mapping.elementRange.start.offset + 
    (line - mapping.elementRange.start.line) * 100 + column; // Approximate

  if (mapping.idRange && 
      offset >= mapping.idRange.start.offset && 
      offset <= mapping.idRange.end.offset) {
    return 'id';
  }

  if (mapping.dRange && 
      offset >= mapping.dRange.start.offset && 
      offset <= mapping.dRange.end.offset) {
    return 'd';
  }

  if (mapping.fillRange && 
      offset >= mapping.fillRange.start.offset && 
      offset <= mapping.fillRange.end.offset) {
    return 'fill';
  }

  if (mapping.strokeRange && 
      offset >= mapping.strokeRange.start.offset && 
      offset <= mapping.strokeRange.end.offset) {
    return 'stroke';
  }

  return null;
}

/**
 * Generate formatted path d attribute with line breaks for each command
 * This is used when a path is selected to make point editing clearer
 */
export function formatPathDataWithPoints(path: Path): {
  formattedD: string;
  pointMappings: PointCodeMapping[];
} {
  const pointMappings: PointCodeMapping[] = [];
  
  // Parse the d attribute and break it into commands
  const commands = parsePathCommands(path.d);
  
  let formattedD = '';
  commands.forEach((cmd, index) => {
    formattedD += cmd.text;
    if (index < commands.length - 1) {
      formattedD += '\n      ';
    }
    
    pointMappings.push({
      pointIndex: index,
      commandType: cmd.type,
      commandRange: {
        start: { line: index + 1, column: 1, offset: 0 }, // Simplified
        end: { line: index + 1, column: cmd.text.length, offset: 0 },
      },
    });
  });

  return { formattedD, pointMappings };
}

interface PathCommand {
  type: string;
  text: string;
}

/**
 * Parse path d attribute into individual commands
 */
function parsePathCommands(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const regex = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;
  
  let match;
  while ((match = regex.exec(d)) !== null) {
    const type = match[1];
    const params = match[2].trim();
    commands.push({
      type,
      text: `${type} ${params}`,
    });
  }
  
  return commands;
}
