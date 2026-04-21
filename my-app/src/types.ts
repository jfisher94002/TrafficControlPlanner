// ─── CORE GEOMETRY ────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface SnapResult extends Point {
  snapped: boolean;
}

// ─── SIGN & DEVICE DATA ───────────────────────────────────────────────────────

export type SignShape = 'diamond' | 'rect' | 'octagon' | 'circle' | 'triangle' | 'shield';

export interface SignData {
  id: string;
  label: string;
  shape: SignShape;
  color: string;
  textColor: string;
  border?: string;
  mutcd?: string;  // MUTCD designation code (e.g. "R1-1", "W20-1")
}

export interface DeviceData {
  id: string;
  label: string;
  icon: string;
  color: string;
}

// ─── ROAD TYPES ───────────────────────────────────────────────────────────────

export interface RoadType {
  id: string;
  label: string;
  lanes: number;
  width: number;
  realWidth: number;
}

// ─── CANVAS OBJECTS (discriminated union on `type`) ───────────────────────────

export interface StraightRoadObject {
  id: string;
  type: 'road';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  realWidth: number;
  lanes: number;
  roadType: string;
  shoulderWidth?: number;   // world px, 0 = disabled
  sidewalkWidth?: number;   // world px, 0 = disabled
  sidewalkSide?: 'both' | 'left' | 'right';  // default 'both'
}

export interface PolylineRoadObject {
  id: string;
  type: 'polyline_road';
  points: Point[];
  width: number;
  realWidth: number;
  lanes: number;
  roadType: string;
  smooth: boolean;
  shoulderWidth?: number;   // world px, 0 = disabled (TODO: rendering not yet implemented)
  sidewalkWidth?: number;   // world px, 0 = disabled (TODO: rendering not yet implemented)
  sidewalkSide?: 'both' | 'left' | 'right';
}

export interface CurveRoadObject {
  id: string;
  type: 'curve_road';
  points: [Point, Point, Point];
  width: number;
  realWidth: number;
  lanes: number;
  roadType: string;
  shoulderWidth?: number;   // world px, 0 = disabled (TODO: rendering not yet implemented)
  sidewalkWidth?: number;   // world px, 0 = disabled (TODO: rendering not yet implemented)
  sidewalkSide?: 'both' | 'left' | 'right';
}

export interface CubicBezierRoadObject {
  id: string;
  type: 'cubic_bezier_road';
  points: [Point, Point, Point, Point]; // [p0=start, cp1, cp2, p3=end]
  width: number;
  realWidth: number;
  lanes: number;
  roadType: string;
  shoulderWidth?: number;   // world px, 0 = disabled (TODO: rendering not yet implemented)
  sidewalkWidth?: number;   // world px, 0 = disabled (TODO: rendering not yet implemented)
  sidewalkSide?: 'both' | 'left' | 'right';
}

export interface SignObject {
  id: string;
  type: 'sign';
  x: number;
  y: number;
  signData: SignData;
  rotation: number;
  scale: number;
}

export interface DeviceObject {
  id: string;
  type: 'device';
  x: number;
  y: number;
  deviceData: DeviceData;
  rotation: number;
}

export interface ZoneObject {
  id: string;
  type: 'zone';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArrowObject {
  id: string;
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface TextObject {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
}

export interface MeasureObject {
  id: string;
  type: 'measure';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TaperObject {
  id: string;
  type: 'taper';
  x: number;
  y: number;
  rotation: number;     // degrees
  laneWidth: number;    // feet, default 12
  speed: number;        // mph, default 45
  taperLength: number;  // feet, auto-calculated or manual
  manualLength: boolean;
  numLanes: number;     // lanes being closed, 1 or 2
}

export interface TurnLaneObject {
  id: string;
  type: 'turn_lane';
  x: number;           // anchor point (where lane branches from road)
  y: number;
  rotation: number;    // degrees — aligns to road direction
  laneWidth: number;   // world px, default 20
  taperLength: number; // world px, default 80 (run-in taper before full width)
  runLength: number;   // world px, default 100 (full-width run section)
  side: 'left' | 'right'; // which side of anchor road the lane opens on
  turnDir: 'left' | 'right' | 'thru'; // arrow direction shown at end
}

export interface LaneMaskObject {
  id: string;
  type: 'lane_mask';
  x1: number;   // start point world coords
  y1: number;
  x2: number;   // end point world coords
  y2: number;
  laneWidth: number;  // width of mask band, world px (default 20)
  color: string;      // default "rgba(239,68,68,0.5)"
  style: 'hatch' | 'solid'; // default 'hatch'
}

export interface CrosswalkObject {
  id: string;
  type: 'crosswalk';
  x1: number;        // one side of the crosswalk (drag start)
  y1: number;
  x2: number;        // other side (drag end)
  y2: number;
  depth: number;     // crosswalk depth along road direction, world px (default 24)
  stripeCount: number;  // number of white stripes (default 6)
  stripeColor: string;  // default "#ffffff"
}

export type CanvasObject =
  | StraightRoadObject
  | PolylineRoadObject
  | CurveRoadObject
  | CubicBezierRoadObject
  | SignObject
  | DeviceObject
  | ZoneObject
  | ArrowObject
  | TextObject
  | MeasureObject
  | TaperObject
  | LaneMaskObject
  | CrosswalkObject
  | TurnLaneObject;

// ─── PLAN METADATA ────────────────────────────────────────────────────────────

export interface CanvasState {
  objects: CanvasObject[];
}

export interface PlanMeta {
  projectNumber: string;
  client: string;
  location: string;
  notes: string;
}

export interface MapCenter {
  lat: number;
  lon: number;
  zoom: number;
}

// ─── INTERNAL UI TYPES ────────────────────────────────────────────────────────

export interface GroupOrig {
  id: string;
  ox?: number;
  oy?: number;
  ox2?: number;
  oy2?: number;
  origPoints?: Point[] | null;
}

export interface DrawStart {
  x: number;
  y: number;
  ox?: number;
  oy?: number;
  id?: string;
  origPoints?: Point[] | null;
  handleIndex?: number | null; // index of the handle being dragged (cubic bezier only)
  groupOrigPositions?: GroupOrig[];
  isMarquee?: boolean;
}

export interface PanStart {
  x: number;
  y: number;
}

export interface MapTileEntry {
  image: HTMLImageElement;
  loaded: boolean;
}

export interface MapTile {
  url: string;
  x: number;
  y: number;
  size: number;
}

export interface ToolDef {
  id: string;
  label: string;
  icon: string;
  shortcut: string;
  helpText?: string;
}

// ─── GEOCODING ────────────────────────────────────────────────────────────────

export interface GeocodeAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  state_district?: string;
}

export interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
  address: GeocodeAddress;
}
