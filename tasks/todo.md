# Issue #27 — Migrate Frontend to TypeScript

## Status: COMPLETE ✓

## What's Done
- [x] `npm install --save-dev typescript` in `my-app/`
- [x] Created `my-app/tsconfig.json` (strict mode, noEmit, moduleResolution: bundler)
- [x] Created `my-app/src/types.ts` (all interfaces defined)
- [x] Created `my-app/vite.config.ts` (renamed from .js, same content)
- [x] Created `my-app/src/main.tsx` (getElementById null assertion fixed)
- [x] Created `my-app/src/App.tsx` (import updated to drop .jsx extension)

## What Remains
- [x] Write `my-app/src/traffic-control-planner.tsx` — THE MAIN FILE
- [x] Update `eslint.config.js` files glob to include `.ts`/`.tsx`
- [x] Update `package.json` scripts (add typecheck, update build)
- [x] Run `npx tsc --noEmit` → zero errors
- [x] Delete old `.jsx` files (main.jsx, App.jsx, traffic-control-planner.jsx, vite.config.js)
- [x] `npm run build` succeeds

## Key Context for Resuming

### Types already in src/types.ts
All interfaces are defined: Point, SnapResult, SignShape, SignData, DeviceData, RoadType,
StraightRoadObject, PolylineRoadObject, CurveRoadObject, SignObject, DeviceObject,
ZoneObject, ArrowObject, TextObject, MeasureObject, CanvasObject (union), CanvasState,
PlanMeta, MapCenter, DrawStart, PanStart, MapTileEntry, MapTile, ToolDef,
GeocodeAddress, GeocodeResult

### Changes needed in traffic-control-planner.tsx vs .jsx

**Imports to add at top:**
```ts
import type Konva from 'konva';
import type { Context as KonvaContext } from 'konva/lib/Context';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { CanvasObject, SignData, DeviceData, RoadType, DrawStart, PanStart,
  MapCenter, MapTile, MapTileEntry, PlanMeta, Point, SnapResult, ToolDef,
  GeocodeResult, GeocodeAddress, SignShape } from './types';
import type React from 'react';
```

**geoRoadWidthPx:**
```ts
function geoRoadWidthPx(road: { width: number; realWidth?: number }, mapCenter: MapCenter | null): number
```

**panelBtnStyle — return type:**
```ts
const panelBtnStyle = (active: boolean): React.CSSProperties => ({...})
```

**snapToEndpoint:**
```ts
function snapToEndpoint(wx: number, wy: number, objects: CanvasObject[], thresholdScreenPx: number, zoom: number): SnapResult
```

**sampleBezier:**
```ts
function sampleBezier(p0: Point, p1: Point, p2: Point, n: number): Point[]
```

**distToSegment / distToPolyline:**
```ts
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number
function distToPolyline(px: number, py: number, points: Point[]): number
```

**geocodeAddress / formatSearchPrimary:**
```ts
async function geocodeAddress(query: string): Promise<GeocodeResult[]>
function formatSearchPrimary(result: GeocodeResult): string
```

**drawSign:**
```ts
function drawSign(ctx: CanvasRenderingContext2D, sign: { x: number; y: number; signData: SignData; rotation: number; scale: number }, isSelected: boolean): void
```

**Component prop interfaces:**
```ts
interface GridLinesProps { offset: Point; zoom: number; canvasSize: { w: number; h: number }; }
interface RoadSegmentProps { obj: StraightRoadObject; isSelected: boolean; }
interface PolylineRoadProps { obj: PolylineRoadObject; isSelected: boolean; }
interface CurveRoadProps { obj: CurveRoadObject; isSelected: boolean; }
interface SignShapeProps { obj: SignObject; isSelected: boolean; }
interface DeviceShapeProps { obj: DeviceObject; isSelected: boolean; }
interface WorkZoneProps { obj: ZoneObject; isSelected: boolean; }
interface ArrowShapeProps { obj: ArrowObject; isSelected: boolean; }
interface TextLabelProps { obj: TextObject; isSelected: boolean; }
interface MeasurementShapeProps { obj: MeasureObject; }
interface ObjectShapeProps { obj: CanvasObject; isSelected: boolean; }
interface ToolButtonProps { tool: ToolDef; active: boolean; onClick: () => void; }
interface SignEditorPanelProps { onUseSign: (signData: SignData) => void; onSaveToLibrary: (signData: SignData) => void; }
interface PropertyPanelProps { selected: string | null; objects: CanvasObject[]; onUpdate: (id: string, updates: Record<string, unknown>) => void; onDelete: (id: string) => void; planMeta: PlanMeta; onUpdateMeta: (meta: PlanMeta) => void; }
interface MiniMapProps { objects: CanvasObject[]; canvasSize: { w: number; h: number }; zoom: number; offset: Point; }
interface DrawingOverlaysProps { tool: string; roadDrawMode: string; drawStart: DrawStart | null; cursorPos: Point; snapIndicator: Point | null; polyPoints: Point[]; curvePoints: Point[]; }
```

**sceneFunc ctx type in SignShape/DeviceShape:**
```ts
sceneFunc={(ctx: KonvaContext) => { ... }}
```

**Refs in main component:**
```ts
const stageRef = useRef<Konva.Stage>(null);
const containerRef = useRef<HTMLDivElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
const mapTileCacheRef = useRef<Record<string, MapTileEntry>>({});
const lastClickTimeRef = useRef<number>(0);
const lastClickPosRef = useRef<Point | null>(null);
// In SignEditorPanel:
const previewRef = useRef<HTMLCanvasElement>(null);
// In MiniMap:
const ref = useRef<HTMLCanvasElement>(null);
```

**State types in main component:**
```ts
const [objects, setObjects] = useState<CanvasObject[]>([]);
const [selected, setSelected] = useState<string | null>(null);
const [panStart, setPanStart] = useState<PanStart | null>(null);
const [drawStart, setDrawStart] = useState<DrawStart | null>(null);
const [selectedSign, setSelectedSign] = useState<SignData>(SIGN_CATEGORIES.regulatory.signs[0]);
const [selectedDevice, setSelectedDevice] = useState<DeviceData>(DEVICES[0]);
const [selectedRoadType, setSelectedRoadType] = useState<RoadType>(ROAD_TYPES[0]);
const [history, setHistory] = useState<CanvasObject[][]>([[]]);
const [planMeta, setPlanMeta] = useState<PlanMeta>({...});
const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
const [polyPoints, setPolyPoints] = useState<Point[]>([]);
const [curvePoints, setCurvePoints] = useState<Point[]>([]);
const [snapIndicator, setSnapIndicator] = useState<Point | null>(null);
const [customSigns, setCustomSigns] = useState<SignData[]>(() => {...});
// In SignEditorPanel:
const [shape, setShape] = useState<SignShape>("diamond");
```

**Event handler types:**
```ts
const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {...})
const handleMouseMove = useCallback((_e: KonvaEventObject<MouseEvent>) => {...})
const handleMouseUp = useCallback((_e: KonvaEventObject<MouseEvent>) => {...})
const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {...})
```

**Property access fixes (critical):**
1. `o.x !== undefined` → `'x' in o` (in handleMouseMove drag and MiniMap)
2. `o.x1 !== undefined` → `'x1' in o`
3. `obj.x !== undefined` → `'x' in obj` (MiniMap)
4. `obj.realWidth` (in render loop) → `('realWidth' in obj && (obj as {realWidth?: number}).realWidth && mapCenter)`
5. `stageRef.current.getPointerPosition()` → `stageRef.current!.getPointerPosition()` (3 places: handleMouseDown pan, handleMouseMove pan, handleWheel)
6. `fileInputRef.current.click()` → `fileInputRef.current!.click()`
7. `loadPlan` evt typing: `(evt: ProgressEvent<FileReader>)` and `evt.target!.result as string`
8. `(e.target as HTMLElement).tagName` in keyboard handler
9. `handleMouseDown drawStart.ox + dx` → `drawStart.ox! + dx` (DrawStart.ox is optional)
10. PropertyPanel `planMeta[key]` — type the fields array as `Array<[string, keyof PlanMeta]>`
11. `setShape(s.id as SignShape)` in SignEditorPanel
12. updateObject: `{ ...o, ...updates } as CanvasObject`
13. In handleMouseMove drag, use `'x' in o` and `'x1' in o` guards with proper casts

**Package.json scripts to update:**
```json
"typecheck": "tsc --noEmit",
"build": "tsc --noEmit && vite build"
```

## Key Gotchas
- `sceneFunc` ctx is `KonvaContext` (from 'konva/lib/Context'), not `CanvasRenderingContext2D`
- `stageRef.current` needs `!` (non-null assertion) in 3 event handlers
- `CurveRoadObject.points` is a `[Point, Point, Point]` tuple — when building: `newCurvePts as [Point, Point, Point]`
- `drawStart.ox!` / `drawStart.oy!` needed in drag handler (optional in interface but always set when id is present)
- `loadPlan` file reader: type as `ProgressEvent<FileReader>` and cast result as string
- `eslint.config.js` needs `**/*.{js,jsx,ts,tsx}` in files glob
- Don't forget to delete old .jsx and vite.config.js files after tsx files are verified

## Definition of Done
- Zero TypeScript compile errors (`npx tsc --noEmit`)
- `objects` state is `CanvasObject[]` (strictly typed)
- All geometry functions have typed inputs/outputs
- CI build passes (`npm run build`)

## Review
Migration complete. Zero TS errors. `npm run build` passes. All .jsx files deleted.
Key decisions: used `Record<string, { label, color, signs: SignData[] }>` for SIGN_CATEGORIES,
`'x' in o` type guards in drag handler, `as CanvasObject` cast on spread-updated objects.
