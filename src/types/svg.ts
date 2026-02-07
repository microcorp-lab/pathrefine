export interface Point {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  translate?: { x: number; y: number };
  rotate?: number;
  scale?: { x: number; y: number };
  raw?: string; // Raw transform string from SVG
}

export interface BezierSegment {
  type: 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z';
  points: Point[];
  start: Point;
  end: Point;
}

export interface Path {
  id: string;
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;       // Overall opacity (0-1)
  fillOpacity?: number;   // Fill opacity (0-1)
  strokeOpacity?: number; // Stroke opacity (0-1)
  transform?: Transform;
  segments: BezierSegment[];
  length?: number;
  visible?: boolean; // Path visibility toggle
}

export interface SVGGroup {
  id: string;
  paths: Path[];
  transform?: Transform;
}

export interface SVGDocument {
  width: number;
  height: number;
  viewBox?: ViewBox;
  paths: Path[];
  groups: SVGGroup[];
}

export interface PathAlignment {
  sourcePathId: string;
  targetPathId: string;
  offset: number;           // Position along target path (0-1)
  perpOffset: number;       // Perpendicular distance from path
  rotation: number;         // Additional rotation in degrees
  preserveShape: boolean;   // Keep original shape vs deform to follow
  repeatCount: number;      // Number of copies (1-100)
  scale: number;            // Scale factor (0.1-2.0)
  pathRangeStart: number;   // Start position on target path (0-1)
  pathRangeEnd: number;     // End position on target path (0-1)
  randomRotation: number;   // Random rotation variation (±degrees)
  randomScale: number;      // Random scale variation (±percentage)
  randomOffset: number;     // Random offset variation (±pixels)
  randomSeed?: number;      // Seed for reproducible randomness
}

export type Tool = 'edit' | 'align' | 'measure' | 'animate';

export interface ControlPoint {
  pathId: string;
  segmentIndex: number;
  pointIndex: number; // 0 for start, 1+ for control points, -1 for end
  point: Point;
  type: 'anchor' | 'control';
}

export interface HistoryEntry {
  svgDocument: SVGDocument;
  timestamp: number;
  action: string; // Description of what changed
}

export interface EditorState {
  svgDocument: SVGDocument | null;
  selectedPathIds: string[];
  activeTool: Tool;
  zoom: number;
  pan: Point;
  alignment: PathAlignment | null;
  editingPathId: string | null;
  selectedPointIndex: number | null;
  selectedPointIndices: number[]; // Multiple selected points
  hoveredPoint: ControlPoint | null;
  history: HistoryEntry[];
  historyIndex: number; // Current position in history (-1 means no history)
  snapToGrid: boolean;
  gridSize: number;
  showHelp: boolean;
  showHeatmap: boolean; // Show complexity heatmap overlay
  marqueeStart: Point | null; // Marquee selection start point
  marqueeEnd: Point | null; // Marquee selection end point
  showCodePanel: boolean; // Show/hide code editor panel
  codePanelHeight: number; // Height of code panel as fraction (0-1)
  codeMappings: Map<string, any> | null; // Path ID -> code position mappings
  isPro: boolean; // Pro tier status (default false = free tier)
  showUpgradeModal: boolean; // Show/hide upgrade modal
  pathAlignmentPreview: Path[] | null; // Preview paths for path alignment
  pathAlignmentSelectionMode: 'none' | 'source' | 'target'; // Path selection mode
}
