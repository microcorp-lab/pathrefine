import type { SVGDocument, Path, ViewBox, BezierSegment, Point } from '../types/svg';
import { bakePathTransform } from './transforms';

/**
 * Parse SVG string or DOM element into our internal document structure
 */
export function parseSVG(svgString: string): SVGDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');

  if (!svgElement) {
    throw new Error('Invalid SVG: No <svg> element found');
  }

  const viewBoxAttr = svgElement.getAttribute('viewBox');
  const viewBox = viewBoxAttr ? parseViewBox(svgElement) : undefined;
  const width = parseFloat(svgElement.getAttribute('width') || (viewBox ? String(viewBox.width) : '400'));
  const height = parseFloat(svgElement.getAttribute('height') || (viewBox ? String(viewBox.height) : '400'));

  const paths: Path[] = [];

  // Collect all shape elements in document order (preserves z-order)
  // querySelectorAll is depth-first so this is already correct
  const shapeSelector = 'path, circle, ellipse, rect, line, polygon, polyline';
  const shapeElements = svgElement.querySelectorAll(shapeSelector);
  let index = 0;

  shapeElements.forEach((el) => {
    // Collect ancestor <g> transforms so nested groups are properly handled
    const ancestorTransform = getAncestorTransform(el, svgElement);

    const tag = el.tagName.toLowerCase();
    let path: Path | null = null;

    if (tag === 'path') {
      path = parsePath(el as SVGPathElement, index, ancestorTransform);
    } else if (tag === 'circle') {
      path = circleToPath(el as SVGCircleElement, index, ancestorTransform);
    } else if (tag === 'ellipse') {
      path = ellipseToPath(el as SVGEllipseElement, index, ancestorTransform);
    } else if (tag === 'rect') {
      path = rectToPath(el as SVGRectElement, index, ancestorTransform);
    } else if (tag === 'line') {
      path = lineToPath(el as SVGLineElement, index, ancestorTransform);
    } else if (tag === 'polygon') {
      path = polygonToPath(el as SVGPolygonElement, index, ancestorTransform, true);
    } else if (tag === 'polyline') {
      path = polygonToPath(el as SVGPolylineElement, index, ancestorTransform, false);
    }

    if (path) {
      // Bake all transforms (own + inherited from ancestor <g> elements) directly
      // into the segment coordinates, then clear the transform field.  This means
      // the editor always works in world-space coordinates so anchor-point editing
      // is always correct regardless of the original SVG grouping structure.
      paths.push(bakePathTransform(path) as Path);
      index++;
    }
  });

  return {
    width,
    height,
    viewBox,
    paths,
    groups: [],
  };
}

/**
 * Parse viewBox attribute
 */
function parseViewBox(svgElement: SVGSVGElement): ViewBox {
  const viewBoxAttr = svgElement.getAttribute('viewBox');
  if (viewBoxAttr) {
    const [x, y, width, height] = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
    return { x, y, width, height };
  }

  const width = parseFloat(svgElement.getAttribute('width') || '400');
  const height = parseFloat(svgElement.getAttribute('height') || '400');
  return { x: 0, y: 0, width, height };
}

/**
 * Collect the combined transform string from all ancestor <g> elements.
 * Returns undefined if no ancestor transforms found.
 */
function getAncestorTransform(el: Element, svgRoot: Element): string | undefined {
  const transforms: string[] = [];
  let node: Element | null = el.parentElement;

  while (node && node !== svgRoot) {
    if (node.tagName.toLowerCase() === 'g') {
      const t = node.getAttribute('transform');
      if (t) transforms.unshift(t); // prepend so outermost comes first
    }
    node = node.parentElement;
  }

  return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Merge a shape's own transform with any inherited ancestor transforms.
 * Returns combined transform string, or undefined if neither exists.
 */
function mergeTransforms(own: string | null | undefined, ancestor: string | undefined): string | undefined {
  const parts = [ancestor, own || undefined].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/** Read common presentation attributes from any SVG element */
function readPresentationAttrs(el: Element) {
  return {
    fill: el.getAttribute('fill') || undefined,
    stroke: el.getAttribute('stroke') || undefined,
    strokeWidth: el.getAttribute('stroke-width')
      ? parseFloat(el.getAttribute('stroke-width')!)
      : undefined,
    opacity: el.getAttribute('opacity')
      ? parseFloat(el.getAttribute('opacity')!)
      : undefined,
    fillOpacity: el.getAttribute('fill-opacity')
      ? parseFloat(el.getAttribute('fill-opacity')!)
      : undefined,
    strokeOpacity: el.getAttribute('stroke-opacity')
      ? parseFloat(el.getAttribute('stroke-opacity')!)
      : undefined,
  };
}

/**
 * Parse a single path element
 */
function parsePath(pathElement: SVGPathElement, index: number, ancestorTransform?: string): Path {
  const id = pathElement.getAttribute('id') || `path-${index}`;
  const d = pathElement.getAttribute('d') || '';
  const attrs = readPresentationAttrs(pathElement);
  const transform = mergeTransforms(pathElement.getAttribute('transform'), ancestorTransform);

  const segments = parsePathData(d);

  return {
    id,
    d,
    ...attrs,
    transform: transform ? { raw: transform } : undefined,
    segments,
  };
}

/**
 * Convert circle element to path
 * Uses 4 cubic bezier curves to approximate a circle
 */
function circleToPath(circleElement: SVGCircleElement, index: number, ancestorTransform?: string): Path {
  const cx = parseFloat(circleElement.getAttribute('cx') || '0');
  const cy = parseFloat(circleElement.getAttribute('cy') || '0');
  const r = parseFloat(circleElement.getAttribute('r') || '0');
  
  // Magic number for circle approximation with cubic bezier: 4/3 * tan(π/8)
  const k = 0.5522847498;
  const kappa = k * r;
  
  // Build path data: 4 cubic curves
  const d = [
    `M ${cx} ${cy - r}`, // Start at top
    `C ${cx + kappa} ${cy - r} ${cx + r} ${cy - kappa} ${cx + r} ${cy}`, // Top-right curve
    `C ${cx + r} ${cy + kappa} ${cx + kappa} ${cy + r} ${cx} ${cy + r}`, // Bottom-right curve
    `C ${cx - kappa} ${cy + r} ${cx - r} ${cy + kappa} ${cx - r} ${cy}`, // Bottom-left curve
    `C ${cx - r} ${cy - kappa} ${cx - kappa} ${cy - r} ${cx} ${cy - r}`, // Top-left curve
    'Z'
  ].join(' ');
  
  const id = circleElement.getAttribute('id') || `circle-${index}`;
  const attrs = readPresentationAttrs(circleElement);
  const transform = mergeTransforms(circleElement.getAttribute('transform'), ancestorTransform);

  const segments = parsePathData(d);

  return {
    id,
    d,
    ...attrs,
    transform: transform ? { raw: transform } : undefined,
    segments,
  };
}

/**
 * Convert ellipse element to path
 * Uses 4 cubic bezier curves to approximate an ellipse
 */
function ellipseToPath(ellipseElement: SVGEllipseElement, index: number, ancestorTransform?: string): Path {
  const cx = parseFloat(ellipseElement.getAttribute('cx') || '0');
  const cy = parseFloat(ellipseElement.getAttribute('cy') || '0');
  const rx = parseFloat(ellipseElement.getAttribute('rx') || '0');
  const ry = parseFloat(ellipseElement.getAttribute('ry') || '0');
  
  // Magic number for circle approximation with cubic bezier
  const k = 0.5522847498;
  const kappaX = k * rx;
  const kappaY = k * ry;
  
  // Build path data: 4 cubic curves
  const d = [
    `M ${cx} ${cy - ry}`, // Start at top
    `C ${cx + kappaX} ${cy - ry} ${cx + rx} ${cy - kappaY} ${cx + rx} ${cy}`, // Top-right curve
    `C ${cx + rx} ${cy + kappaY} ${cx + kappaX} ${cy + ry} ${cx} ${cy + ry}`, // Bottom-right curve
    `C ${cx - kappaX} ${cy + ry} ${cx - rx} ${cy + kappaY} ${cx - rx} ${cy}`, // Bottom-left curve
    `C ${cx - rx} ${cy - kappaY} ${cx - kappaX} ${cy - ry} ${cx} ${cy - ry}`, // Top-left curve
    'Z'
  ].join(' ');
  
  const id = ellipseElement.getAttribute('id') || `ellipse-${index}`;
  const attrs = readPresentationAttrs(ellipseElement);
  const transform = mergeTransforms(ellipseElement.getAttribute('transform'), ancestorTransform);

  const segments = parsePathData(d);

  return {
    id,
    d,
    ...attrs,
    transform: transform ? { raw: transform } : undefined,
    segments,
  };
}

/**
 * Convert rect element to path.
 * Supports optional rx/ry for rounded corners.
 */
function rectToPath(rectElement: SVGRectElement, index: number, ancestorTransform?: string): Path {
  const x = parseFloat(rectElement.getAttribute('x') || '0');
  const y = parseFloat(rectElement.getAttribute('y') || '0');
  const w = parseFloat(rectElement.getAttribute('width') || '0');
  const h = parseFloat(rectElement.getAttribute('height') || '0');

  // rx/ry — if only one is specified, the other defaults to it
  let rx = rectElement.getAttribute('rx') ? parseFloat(rectElement.getAttribute('rx')!) : null;
  let ry = rectElement.getAttribute('ry') ? parseFloat(rectElement.getAttribute('ry')!) : null;
  if (rx === null && ry === null) { rx = 0; ry = 0; }
  else if (rx === null) { rx = ry!; }
  else if (ry === null) { ry = rx; }

  // Clamp to half dimensions per SVG spec
  rx = Math.min(rx!, w / 2);
  ry = Math.min(ry!, h / 2);

  let d: string;
  if (rx === 0 && ry === 0) {
    d = `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  } else {
    // Rounded rectangle using arc commands – existing parsePathData will convert A→cubic
    d = [
      `M ${x + rx} ${y}`,
      `H ${x + w - rx}`,
      `A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
      `V ${y + h - ry}`,
      `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
      `H ${x + rx}`,
      `A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
      `V ${y + ry}`,
      `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
      `Z`,
    ].join(' ');
  }

  const id = rectElement.getAttribute('id') || `rect-${index}`;
  const attrs = readPresentationAttrs(rectElement);
  const transform = mergeTransforms(rectElement.getAttribute('transform'), ancestorTransform);

  return {
    id,
    d,
    ...attrs,
    transform: transform ? { raw: transform } : undefined,
    segments: parsePathData(d),
  };
}

/**
 * Convert line element to path: M x1 y1 L x2 y2
 */
function lineToPath(lineElement: SVGLineElement, index: number, ancestorTransform?: string): Path {
  const x1 = parseFloat(lineElement.getAttribute('x1') || '0');
  const y1 = parseFloat(lineElement.getAttribute('y1') || '0');
  const x2 = parseFloat(lineElement.getAttribute('x2') || '0');
  const y2 = parseFloat(lineElement.getAttribute('y2') || '0');

  const d = `M ${x1} ${y1} L ${x2} ${y2}`;
  const id = lineElement.getAttribute('id') || `line-${index}`;
  const attrs = readPresentationAttrs(lineElement);
  const transform = mergeTransforms(lineElement.getAttribute('transform'), ancestorTransform);

  return {
    id,
    d,
    ...attrs,
    transform: transform ? { raw: transform } : undefined,
    segments: parsePathData(d),
  };
}

/**
 * Convert polygon or polyline element to path.
 * polygon: closed (appends Z), polyline: open
 */
function polygonToPath(
  el: SVGPolygonElement | SVGPolylineElement,
  index: number,
  ancestorTransform: string | undefined,
  closed: boolean
): Path {
  const pointsAttr = el.getAttribute('points') || '';
  // Parse pairs of numbers separated by commas or whitespace
  const nums = pointsAttr.trim().replace(/,/g, ' ').split(/\s+/).map(parseFloat).filter(n => !isNaN(n));

  const parts: string[] = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    parts.push(i === 0 ? `M ${nums[i]} ${nums[i + 1]}` : `L ${nums[i]} ${nums[i + 1]}`);
  }
  if (closed && parts.length > 0) parts.push('Z');

  const d = parts.join(' ');
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id') || `${tag}-${index}`;
  const attrs = readPresentationAttrs(el);
  const transform = mergeTransforms(el.getAttribute('transform'), ancestorTransform);

  return {
    id,
    d,
    ...attrs,
    transform: transform ? { raw: transform } : undefined,
    segments: parsePathData(d),
  };
}

/**
 * Parse path data string into segments
 * Handles M, L, C, Q, A, Z commands
 */
export function parsePathData(d: string): BezierSegment[] {
  const segments: BezierSegment[] = [];
  let currentPoint: Point = { x: 0, y: 0 };
  let startPoint: Point = { x: 0, y: 0 };
  let lastControlPoint: Point | null = null; // For S and T commands

  // Remove extra whitespace and commas
  const cleaned = d.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Split into commands
  const commands = cleaned.match(/[a-df-z][^a-df-z]*/gi) || [];

  for (const cmd of commands) {
    const type = cmd[0].toUpperCase() as BezierSegment['type'];
    const isRelative = cmd[0] === cmd[0].toLowerCase();
    // SVG path data uses sign and decimal point as implicit separators, e.g.
    // "1-2.4-3" → [1, -2.4, -3] and "-.3.2-.8" → [-0.3, 0.2, -0.8].
    // split(/\s+/) fails for these cases; a regex tokenizer handles all forms.
    const coords = [...cmd.slice(1).matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)]
      .map(m => parseFloat(m[0]))
      .filter(n => !isNaN(n));

    switch (type) {
      case 'M': {
        const x = isRelative ? currentPoint.x + coords[0] : coords[0];
        const y = isRelative ? currentPoint.y + coords[1] : coords[1];
        currentPoint = { x, y };
        startPoint = { x, y };
        lastControlPoint = null; // Reset control point tracking
        segments.push({
          type: 'M',
          points: [currentPoint],
          start: currentPoint,
          end: currentPoint,
        });
        break;
      }

      case 'L': {
        for (let i = 0; i < coords.length; i += 2) {
          const x = isRelative ? currentPoint.x + coords[i] : coords[i];
          const y = isRelative ? currentPoint.y + coords[i + 1] : coords[i + 1];
          const newPoint = { x, y };
          segments.push({
            type: 'L',
            points: [newPoint],
            start: currentPoint,
            end: newPoint,
          });
          currentPoint = newPoint;
          lastControlPoint = null;
        }
        break;
      }

      case 'H': {
        // Horizontal line - only x coordinate changes
        for (let i = 0; i < coords.length; i++) {
          const x = isRelative ? currentPoint.x + coords[i] : coords[i];
          const newPoint = { x, y: currentPoint.y };
          segments.push({
            type: 'L',
            points: [newPoint],
            start: currentPoint,
            end: newPoint,
          });
          currentPoint = newPoint;
          lastControlPoint = null;
        }
        break;
      }

      case 'V': {
        // Vertical line - only y coordinate changes
        for (let i = 0; i < coords.length; i++) {
          const y = isRelative ? currentPoint.y + coords[i] : coords[i];
          const newPoint = { x: currentPoint.x, y };
          segments.push({
            type: 'L',
            points: [newPoint],
            start: currentPoint,
            end: newPoint,
          });
          currentPoint = newPoint;
          lastControlPoint = null;
        }
        break;
      }

      case 'C': {
        for (let i = 0; i < coords.length; i += 6) {
          const c1 = {
            x: isRelative ? currentPoint.x + coords[i] : coords[i],
            y: isRelative ? currentPoint.y + coords[i + 1] : coords[i + 1],
          };
          const c2 = {
            x: isRelative ? currentPoint.x + coords[i + 2] : coords[i + 2],
            y: isRelative ? currentPoint.y + coords[i + 3] : coords[i + 3],
          };
          const end = {
            x: isRelative ? currentPoint.x + coords[i + 4] : coords[i + 4],
            y: isRelative ? currentPoint.y + coords[i + 5] : coords[i + 5],
          };
          segments.push({
            type: 'C',
            points: [c1, c2],  // Only control points, not end point
            start: currentPoint,
            end,
          });
          lastControlPoint = c2; // Track second control point for S command
          currentPoint = end;
        }
        break;
      }

      case 'S': {
        // Smooth cubic bezier - first control point is reflection of last control point
        for (let i = 0; i < coords.length; i += 4) {
          const c1 = lastControlPoint
            ? { x: 2 * currentPoint.x - lastControlPoint.x, y: 2 * currentPoint.y - lastControlPoint.y }
            : currentPoint;
          const c2 = {
            x: isRelative ? currentPoint.x + coords[i] : coords[i],
            y: isRelative ? currentPoint.y + coords[i + 1] : coords[i + 1],
          };
          const end = {
            x: isRelative ? currentPoint.x + coords[i + 2] : coords[i + 2],
            y: isRelative ? currentPoint.y + coords[i + 3] : coords[i + 3],
          };
          segments.push({
            type: 'C',
            points: [c1, c2],  // Only control points, not end point
            start: currentPoint,
            end,
          });
          lastControlPoint = c2;
          currentPoint = end;
        }
        break;
      }

      case 'Q': {
        for (let i = 0; i < coords.length; i += 4) {
          const c = {
            x: isRelative ? currentPoint.x + coords[i] : coords[i],
            y: isRelative ? currentPoint.y + coords[i + 1] : coords[i + 1],
          };
          const end = {
            x: isRelative ? currentPoint.x + coords[i + 2] : coords[i + 2],
            y: isRelative ? currentPoint.y + coords[i + 3] : coords[i + 3],
          };
          segments.push({
            type: 'Q',
            points: [c],  // Only control point, not end point
            start: currentPoint,
            end,
          });
          lastControlPoint = c; // Track control point for T command
          currentPoint = end;
        }
        break;
      }

      case 'T': {
        // Smooth quadratic bezier - control point is reflection of last control point
        for (let i = 0; i < coords.length; i += 2) {
          const c: Point = lastControlPoint
            ? { x: 2 * currentPoint.x - lastControlPoint.x, y: 2 * currentPoint.y - lastControlPoint.y }
            : currentPoint;
          const end = {
            x: isRelative ? currentPoint.x + coords[i] : coords[i],
            y: isRelative ? currentPoint.y + coords[i + 1] : coords[i + 1],
          };
          segments.push({
            type: 'Q',
            points: [c],  // Only control point, not end point
            start: currentPoint,
            end,
          });
          lastControlPoint = c;
          currentPoint = end;
        }
        break;
      }

      case 'A': {
        // Elliptical arc - convert to cubic bezier curves
        for (let i = 0; i < coords.length; i += 7) {
          const rx = Math.abs(coords[i]);
          const ry = Math.abs(coords[i + 1]);
          const xAxisRotation = coords[i + 2];
          const largeArcFlag = coords[i + 3];
          const sweepFlag = coords[i + 4];
          const x = isRelative ? currentPoint.x + coords[i + 5] : coords[i + 5];
          const y = isRelative ? currentPoint.y + coords[i + 6] : coords[i + 6];

          // Convert arc to cubic bezier curves
          const arcSegments = arcToBezier(
            currentPoint.x,
            currentPoint.y,
            rx,
            ry,
            xAxisRotation,
            largeArcFlag,
            sweepFlag,
            x,
            y
          );

          for (const arcSeg of arcSegments) {
            segments.push({
              type: 'C',
              points: [arcSeg.cp1, arcSeg.cp2, arcSeg.end],
              start: currentPoint,
              end: arcSeg.end,
            });
            currentPoint = arcSeg.end;
          }
          
          lastControlPoint = null;
        }
        break;
      }

      case 'Z': {
        segments.push({
          type: 'Z',
          points: [],
          start: currentPoint,
          end: startPoint,
        });
        currentPoint = startPoint;
        lastControlPoint = null;
        break;
      }
    }
  }

  return segments;
}

/**
 * Convert an elliptical arc to cubic bezier curves
 * Based on SVG spec: https://www.w3.org/TR/SVG/implnotes.html#ArcImplementationNotes
 */
function arcToBezier(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angle: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number
): Array<{ cp1: Point; cp2: Point; end: Point }> {
  // Handle degenerate cases
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) {
    return [{ cp1: { x: x1, y: y1 }, cp2: { x: x2, y: y2 }, end: { x: x2, y: y2 } }];
  }

  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  // Step 2: Correct radii if needed
  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  const lambda = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    rxAbs *= Math.sqrt(lambda);
    ryAbs *= Math.sqrt(lambda);
  }

  // Step 3: Compute center point (cx', cy')
  const sign = largeArcFlag !== sweepFlag ? 1 : -1;
  const sq =
    (rxAbs * rxAbs * ryAbs * ryAbs - rxAbs * rxAbs * y1p * y1p - ryAbs * ryAbs * x1p * x1p) /
    (rxAbs * rxAbs * y1p * y1p + ryAbs * ryAbs * x1p * x1p);
  const coef = sign * Math.sqrt(Math.max(0, sq));
  const cxp = (coef * rxAbs * y1p) / ryAbs;
  const cyp = -(coef * ryAbs * x1p) / rxAbs;

  // Step 4: Compute center point (cx, cy)
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  // Step 5: Compute angles
  const theta1 = Math.atan2((y1p - cyp) / ryAbs, (x1p - cxp) / rxAbs);
  const theta2 = Math.atan2((-y1p - cyp) / ryAbs, (-x1p - cxp) / rxAbs);

  let dTheta = theta2 - theta1;
  if (sweepFlag && dTheta < 0) {
    dTheta += 2 * Math.PI;
  } else if (!sweepFlag && dTheta > 0) {
    dTheta -= 2 * Math.PI;
  }

  // Split arc into multiple segments (max 90 degrees each)
  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const alpha = Math.sin(delta) * (Math.sqrt(4 + 3 * Math.tan(delta / 2) ** 2) - 1) / 3;

  const result: Array<{ cp1: Point; cp2: Point; end: Point }> = [];
  
  for (let i = 0; i < segments; i++) {
    const theta = theta1 + delta * i;
    const thetaNext = theta + delta;

    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const cosThetaNext = Math.cos(thetaNext);
    const sinThetaNext = Math.sin(thetaNext);

    // First control point
    const q1x = cosTheta - sinTheta * alpha;
    const q1y = sinTheta + cosTheta * alpha;
    const cp1x = cos * rxAbs * q1x - sin * ryAbs * q1y + cx;
    const cp1y = sin * rxAbs * q1x + cos * ryAbs * q1y + cy;

    // Second control point
    const q2x = cosThetaNext + sinThetaNext * alpha;
    const q2y = sinThetaNext - cosThetaNext * alpha;
    const cp2x = cos * rxAbs * q2x - sin * ryAbs * q2y + cx;
    const cp2y = sin * rxAbs * q2x + cos * ryAbs * q2y + cy;

    // End point
    const epx = cos * rxAbs * cosThetaNext - sin * ryAbs * sinThetaNext + cx;
    const epy = sin * rxAbs * cosThetaNext + cos * ryAbs * sinThetaNext + cy;

    result.push({
      cp1: { x: cp1x, y: cp1y },
      cp2: { x: cp2x, y: cp2y },
      end: { x: epx, y: epy },
    });
  }

  return result;
}

/**
 * Convert path segments back to SVG path data string
 */
export function segmentsToPathData(segments: BezierSegment[]): string {
  if (segments.length === 0) return '';

  let lastX: number | null = null;
  let lastY: number | null = null;

  // Helper to round for cleaner SVG strings and to avoid floating point noise
  const r = (n: number) => {
    if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) {
      // Return 0 but don't log errors in production to avoid console flood
      return 0;
    }
    return Math.round(n * 1000) / 1000;
  };

  return segments.map((seg, i) => {
    // Optimization: Skip redundant MoveTo if we are already at that position
    if (seg.type === 'M' && i > 0 && lastX !== null && lastY !== null && 
        r(seg.start.x) === r(lastX) && r(seg.start.y) === r(lastY)) {
      return '';
    }

    let command = '';
    switch (seg.type) {
      case 'M':
        command = `M ${r(seg.start.x)} ${r(seg.start.y)}`;
        lastX = seg.start.x;
        lastY = seg.start.y;
        break;
      case 'L':
        command = `L ${r(seg.end.x)} ${r(seg.end.y)}`;
        lastX = seg.end.x;
        lastY = seg.end.y;
        break;
      case 'C': {
        const cp1 = seg.points[0];
        const cp2 = seg.points[1];
        if (!cp1 || !cp2) {
          command = `L ${r(seg.end.x)} ${r(seg.end.y)}`;
        } else {
          command = `C ${r(cp1.x)} ${r(cp1.y)} ${r(cp2.x)} ${r(cp2.y)} ${r(seg.end.x)} ${r(seg.end.y)}`;
        }
        lastX = seg.end.x;
        lastY = seg.end.y;
        break;
      }
      case 'Q': {
        const cp = seg.points[0];
        if (!cp) {
          command = `L ${r(seg.end.x)} ${r(seg.end.y)}`;
        } else {
          command = `Q ${r(cp.x)} ${r(cp.y)} ${r(seg.end.x)} ${r(seg.end.y)}`;
        }
        lastX = seg.end.x;
        lastY = seg.end.y;
        break;
      }
      case 'A': {
        // Arc command: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
        if (seg.arcParams) {
          const { rx, ry, xAxisRotation, largeArcFlag, sweepFlag } = seg.arcParams;
          command = `A ${r(rx)} ${r(ry)} ${r(xAxisRotation)} ${largeArcFlag} ${sweepFlag} ${r(seg.end.x)} ${r(seg.end.y)}`;
        } else {
          // Fallback to line if arcParams missing
          command = `L ${r(seg.end.x)} ${r(seg.end.y)}`;
        }
        lastX = seg.end.x;
        lastY = seg.end.y;
        break;
      }
      case 'Z':
        command = 'Z';
        // After Z, the "current point" moves back to the start of the subpath
        // We find the most recent 'M' command to track current position
        for (let j = i; j >= 0; j--) {
          if (segments[j].type === 'M') {
            lastX = segments[j].start.x;
            lastY = segments[j].start.y;
            break;
          }
        }
        break;
      default:
        return '';
    }
    return command;
  })
  .filter(cmd => cmd !== '') // Remove the skipped redundant commands
  .join(' ')
  .trim();
}

/**
 * Export SVG document back to string
 */
export function exportSVG(doc: SVGDocument): string {
  const { width, height, viewBox, paths } = doc;
  
  let svg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" `;
  svg += `width="${width}" height="${height}"`;
  if (viewBox) {
    svg += ` viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"`;
  }
  svg += '>';
  svg += '\n';

  for (const path of paths) {
    svg += '  <path';
    if (path.id) svg += ` id="${path.id}"`;
    svg += ` d="${path.d}"`;
    if (path.fill) svg += ` fill="${path.fill}"`;
    if (path.stroke) svg += ` stroke="${path.stroke}"`;
    if (path.strokeWidth) svg += ` stroke-width="${path.strokeWidth}"`;
    if (path.opacity !== undefined) svg += ` opacity="${path.opacity}"`;
    if (path.fillOpacity !== undefined) svg += ` fill-opacity="${path.fillOpacity}"`;
    if (path.strokeOpacity !== undefined) svg += ` stroke-opacity="${path.strokeOpacity}"`;
    if (path.transform) svg += ` transform="${path.transform.raw}"`;
    svg += ' />\n';
  }

  svg += '</svg>';
  return svg;
}
