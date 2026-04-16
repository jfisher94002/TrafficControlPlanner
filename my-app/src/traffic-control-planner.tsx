import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva";
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type React from 'react';
import type {
  CanvasObject, StraightRoadObject, PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject,
  SignObject, DeviceObject, TaperObject, TurnLaneObject,
  SignData, DeviceData, RoadType, DrawStart, PanStart,
  MapCenter, MapTile, MapTileEntry, PlanMeta, Point, SnapResult,
  GeocodeResult, TextObject,
} from './types';
import { uid, dist, geoRoadWidthPx, snapToEndpoint, sampleBezier, sampleCubicBezier, distToPolyline, formatSearchPrimary, geocodeAddress, isPointObject, isLineObject, isMultiPointRoad, calcTaperLength, cloneObject, buildTileUrl } from './utils';
import { savePlanToCloud } from './planStorage';
import PlanDashboard from './PlanDashboard';
import TemplatePicker from './TemplatePicker';
import ExportPreviewModal from './ExportPreviewModal';
import { runQCChecks, type QCIssue } from './qcRules';
import { track } from './analytics';
import { DEVICES, ROAD_TYPES, SIGN_CATEGORIES, TOOLS, TOOLS_REQUIRING_MAP } from './features/tcp/tcpCatalog';
import { GridLines, ObjectShape, TAPER_SCALE } from './components/tcp/canvas/ObjectShapes';
import { DrawingOverlays } from './components/tcp/canvas/DrawingOverlays';
import { ToolButton } from './components/tcp/ui/ToolButton';
import { SignEditorPanel } from './components/tcp/panels/SignEditorPanel';
import { COLORS, MIN_ZOOM, MAX_ZOOM, SNAP_RADIUS } from './features/tcp/constants';
import { TILE_URL_TEMPLATE } from './features/tcp/tileUrl';
import { normalizeForSearch, createIntersectionRoads, AUTOSAVE_KEY, readAutosave } from './features/tcp/planUtils';
import { sectionTitle, panelBtnStyle } from './features/tcp/panelHelpers';
import { HelpModal } from './components/tcp/panels/HelpModal';
import { ManifestPanel } from './components/tcp/panels/ManifestPanel';
import { QCPanel, getQCBadgeColor } from './components/tcp/panels/QCPanel';
import { PropertyPanel } from './components/tcp/panels/PropertyPanel';
import { MiniMap, latLonToPixel, pixelToLatLon } from './components/tcp/canvas/MiniMap';
import { LegendBox, NorthArrow } from './components/tcp/canvas/LegendBox';

// GridLines, RoadSegment, PolylineRoad, CurveRoad, CubicBezierRoad, SignShape, DeviceShape,
// WorkZone, ArrowShape, TextLabel, MeasurementShape, TaperShape, ObjectShape
//   → src/components/tcp/canvas/ObjectShapes.tsx
// DrawingOverlays → src/components/tcp/canvas/DrawingOverlays.tsx
// ToolButton     → src/components/tcp/ui/ToolButton.tsx
// SignEditorPanel → src/components/tcp/panels/SignEditorPanel.tsx


// ─── MAIN APP ─────────────────────────────────────────────────────────────────
interface PlannerProps {
  userId?: string | null;
  userEmail?: string | null;
  onSignOut?: () => void;
  onRequestSignIn?: () => void;
}

const CLOUD_ENABLED = Boolean(import.meta.env.VITE_S3_BUCKET && import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID);
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || 'jfisher@fisherconsulting.org';
const BANNER_KEY = 'tcp_prebeta_banner_dismissed';
const PDF_SEEN_KEY = 'tcp_pdf_export_seen';

export default function TrafficControlPlanner({ userId = null, userEmail = null, onSignOut, onRequestSignIn }: PlannerProps = {}) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const pdfExportedRef = useRef<boolean>(false);

  // Read autosave once — reused by all useState initializers below
  const initialAutosave = useRef(readAutosave()).current;

  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem(BANNER_KEY) === '1');
  const [pdfSeen, setPdfSeen] = useState(() => sessionStorage.getItem(PDF_SEEN_KEY) === '1');

  const dismissBanner = () => { sessionStorage.setItem(BANNER_KEY, '1'); setBannerDismissed(true); };

  // Core state
  const [tool, setTool] = useState("select");
  const [objects, setObjects] = useState<CanvasObject[]>(() => initialAutosave?.canvasState?.objects ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(() => initialAutosave?.canvasZoom ?? 1);
  const [offset, setOffset] = useState<Point>(() => initialAutosave?.canvasOffset ?? { x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<PanStart | null>(null);
  const [drawStart, setDrawStart] = useState<DrawStart | null>(null);
  const [selectedSign, setSelectedSign] = useState<SignData>(SIGN_CATEGORIES.regulatory.signs[0]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceData>(DEVICES[0]);
  const [selectedRoadType, setSelectedRoadType] = useState<RoadType>(ROAD_TYPES[0]);
  const [signCategory, setSignCategory] = useState("regulatory");
  const [leftPanel, setLeftPanel] = useState("tools");
  const [rightPanel, setRightPanel] = useState(true);
  const [rightTab, setRightTab] = useState<"properties" | "manifest" | "qc">("properties");
  const propertiesTabRef = useRef<HTMLButtonElement | null>(null);
  const manifestTabRef = useRef<HTMLButtonElement | null>(null);
  const qcTabRef = useRef<HTMLButtonElement | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showNorthArrow, setShowNorthArrow] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [history, setHistory] = useState<CanvasObject[][]>(() => [initialAutosave?.canvasState?.objects ?? []]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [planTitle, setPlanTitle] = useState<string>(() => initialAutosave?.name ?? "Untitled Traffic Control Plan");
  const [planId, setPlanId] = useState<string>(() => initialAutosave?.id ?? uid());
  const [planCreatedAt, setPlanCreatedAt] = useState<string>(() => initialAutosave?.createdAt ?? new Date().toISOString());
  const [planMeta, setPlanMeta] = useState<PlanMeta>(() => initialAutosave?.metadata ?? { projectNumber: "", client: "", location: "", notes: "" });
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<CanvasObject | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [exportPreview, setExportPreview] = useState<Record<string, unknown> | null>(null);
  const qcIssues: QCIssue[] = useMemo(() => runQCChecks(objects), [objects]);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addrModalGoRef = useRef<HTMLButtonElement>(null);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddressRequired, setShowAddressRequired] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(() => {
    const raw = initialAutosave?.mapCenter as { lat: number; lng?: number; lon?: number; zoom: number } | null | undefined;
    const lon = raw?.lng ?? raw?.lon;
    return raw != null && lon != null ? { lat: raw.lat, lon, zoom: raw.zoom } : null;
  });
  const [mapRenderTick, setMapRenderTick] = useState(0);
  const mapTileCacheRef = useRef<Record<string, MapTileEntry>>({});

  const [roadDrawMode, setRoadDrawMode] = useState("straight");
  const [intersectionType, setIntersectionType] = useState<'t' | '4way'>('4way');
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  const [cubicPoints, setCubicPoints] = useState<Point[]>([]);
  const [snapIndicator, setSnapIndicator] = useState<Point | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [signSubTab, setSignSubTab] = useState("library");
  const [signSearch, setSignSearch] = useState("");
  const [customSigns, setCustomSigns] = useState<SignData[]>(() => {
    try { return JSON.parse(localStorage.getItem("tcp_custom_signs") || "[]"); }
    catch { return []; }
  });

  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<Point | null>(null);

  // Map tiles
  const mapTiles = useMemo<MapTile[]>(() => {
    if (!mapCenter) return [];
    const tileSize = 256;
    const zoomLevel = mapCenter.zoom;
    const scale = Math.pow(2, zoomLevel) * tileSize;
    const centerX = ((mapCenter.lon + 180) / 360) * scale;
    const sinLat = Math.sin((mapCenter.lat * Math.PI) / 180);
    const centerY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    const left = centerX - canvasSize.w / 2, top = centerY - canvasSize.h / 2;
    const startTileX = Math.floor(left / tileSize), endTileX = Math.floor((left + canvasSize.w) / tileSize);
    const startTileY = Math.floor(top / tileSize), endTileY = Math.floor((top + canvasSize.h) / tileSize);
    const maxTile = Math.pow(2, zoomLevel);
    const tiles: MapTile[] = [];
    for (let ty = startTileY; ty <= endTileY; ty++) {
      if (ty < 0 || ty >= maxTile) continue;
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        tiles.push({ url: buildTileUrl(TILE_URL_TEMPLATE, zoomLevel, wrappedX, ty), x: tx * tileSize - left, y: ty * tileSize - top, size: tileSize });
      }
    }
    return tiles;
  }, [mapCenter, canvasSize.w, canvasSize.h]);

  useEffect(() => {
    mapTiles.forEach((tile) => {
      if (mapTileCacheRef.current[tile.url]) return;
      const image = new Image();
      image.crossOrigin = "anonymous";
      const entry: MapTileEntry = { image, loaded: false };
      mapTileCacheRef.current[tile.url] = entry;
      image.onload = () => { entry.loaded = true; setMapRenderTick((t) => t + 1); };
      image.onerror = () => { delete mapTileCacheRef.current[tile.url]; };
      image.src = tile.url;
    });
  }, [mapTiles]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Session duration tracking
  useEffect(() => {
    const initialObjectCount = initialAutosave?.canvasState?.objects?.length ?? 0;
    track('app_session_started', {
      resumed_plan: initialObjectCount > 0,
      object_count: initialObjectCount,
    });
    const handleUnload = () => {
      const duration_seconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      track('app_session_ended', {
        duration_seconds,
        pdf_exported: pdfExportedRef.current,
      });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear poly/curve/cubic in-progress when tool or draw mode changes
  useEffect(() => {
    if (tool !== "road") { setPolyPoints([]); setCurvePoints([]); setCubicPoints([]); }
  }, [tool]);
  useEffect(() => {
    setPolyPoints([]); setCurvePoints([]); setCubicPoints([]);
  }, [roadDrawMode]);

  // Sync custom signs to localStorage
  useEffect(() => {
    localStorage.setItem("tcp_custom_signs", JSON.stringify(customSigns));
  }, [customSigns]);

  // Auto-save plan state on every change
  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        id: planId, name: planTitle, createdAt: planCreatedAt,
        updatedAt: new Date().toISOString(),
        userId: userId,
        canvasOffset: offset, canvasZoom: zoom,
        canvasState: { objects }, metadata: planMeta,
        mapCenter,
      }));
      setAutosaveError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[TCP] Auto-save failed:", msg);
      setAutosaveError(msg);
    }
  }, [objects, planTitle, planMeta, planId, planCreatedAt, zoom, offset, mapCenter, userId]);

  // Passive wheel listener to prevent page scroll
  useEffect(() => {
    const el = stageRef.current?.container();
    if (!el) return;
    const h = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  // History
  const pushHistory = useCallback((newObjects: CanvasObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newObjects);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setObjects(history[historyIndex - 1]); setSelected(null); }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setObjects(history[historyIndex + 1]); setSelected(null); }
  }, [history, historyIndex]);

  const switchTool = useCallback((newTool: string) => {
    setTool(newTool);
    setPolyPoints([]);
    setCurvePoints([]);
    setCubicPoints([]);
  }, []);

  /** Switches tool, showing the address-required modal if a map is needed. */
  const requestTool = useCallback((newTool: string) => {
    if (!mapCenter && TOOLS_REQUIRING_MAP.has(newTool)) {
      setShowAddressRequired(true);
      return;
    }
    switchTool(newTool);
  }, [mapCenter, switchTool]);

  const handleRightTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, current: "properties" | "manifest" | "qc") => {
    const tabs: Array<"properties" | "manifest" | "qc"> = ["properties", "manifest", "qc"];
    const idx = tabs.indexOf(current);
    const next: "properties" | "manifest" | "qc" | null =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? tabs[(idx + 1) % tabs.length]
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? tabs[(idx - 1 + tabs.length) % tabs.length]
      : e.key === "Home" ? "properties"
      : e.key === "End"  ? "qc"
      : null;
    if (next) {
      e.preventDefault();
      setRightTab(next);
      (next === "properties" ? propertiesTabRef : next === "manifest" ? manifestTabRef : qcTabRef).current?.focus();
    }
  }, []);

  // Address-required modal: auto-focus, focus trap, Escape, and focus restore
  useEffect(() => {
    if (!showAddressRequired) return;
    const prev = document.activeElement as HTMLElement | null;
    addrModalGoRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowAddressRequired(false); return; }
      if (e.key === 'Tab') {
        const modal = addrModalGoRef.current?.closest('[data-testid="address-required-modal"]');
        if (!modal) return;
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button,input,[tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      prev?.focus();
    };
  }, [showAddressRequired]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      const key = e.key.toUpperCase();

      if (e.metaKey || e.ctrlKey) {
        if (key === "Z" && e.shiftKey) { e.preventDefault(); redo(); return; }
        if (key === "Z") { e.preventDefault(); undo(); return; }
        if (key === "Y") { e.preventDefault(); redo(); return; }
        if (key === "C" && selected) {
          e.preventDefault();
          const obj = objects.find((o) => o.id === selected);
          if (obj) setClipboard(obj);
          return;
        }
        if (key === "V" && clipboard) {
          e.preventDefault();
          const clone = cloneObject(clipboard);
          const newObjs = [...objects, clone];
          setObjects(newObjs); pushHistory(newObjs); setSelected(clone.id);
          setClipboard(clone); // shift clipboard so repeated Ctrl+V continues to offset
          return;
        }
        if (key === "D" && selected) {
          e.preventDefault();
          const obj = objects.find((o) => o.id === selected);
          if (obj) {
            const clone = cloneObject(obj);
            const newObjs = [...objects, clone];
            setObjects(newObjs); pushHistory(newObjs); setSelected(clone.id);
          }
          return;
        }
      }

      if (key === "ESCAPE") {
        setPolyPoints([]); setCurvePoints([]); setCubicPoints([]); setDrawStart(null); return;
      }

      if (key === "ENTER") {
        if (tool === "road" && (roadDrawMode === "poly" || roadDrawMode === "smooth") && polyPoints.length >= 2) {
          const newRoad: PolylineRoadObject = { id: uid(), type: "polyline_road", points: [...polyPoints], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id, smooth: roadDrawMode === "smooth" };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setPolyPoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: roadDrawMode, point_count: polyPoints.length });
        }
        return;
      }

      if (key === "DELETE" || key === "BACKSPACE") {
        if (selected) {
          const newObjs = objects.filter((o) => o.id !== selected);
          setObjects(newObjs); pushHistory(newObjs); setSelected(null);
        }
        return;
      }

      if (key === "?") {
        setShowHelp((v) => !v);
        return;
      }

      const t = TOOLS.find((t) => t.shortcut === key);
      if (t) requestTool(t.id);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, objects, clipboard, undo, redo, pushHistory, tool, roadDrawMode, polyPoints, selectedRoadType, requestTool]);

  // toWorld: uses Konva Stage pointer position
  const toWorld = useCallback((): Point => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - offset.x) / zoom,
      y: (pos.y - offset.y) / zoom,
    };
  }, [offset, zoom]);

  const trySnap = useCallback((x: number, y: number): SnapResult => {
    if (!snapEnabled) return { x, y, snapped: false };
    return snapToEndpoint(x, y, objects, SNAP_RADIUS, zoom);
  }, [snapEnabled, objects, zoom]);

  const hitTest = useCallback((wx: number, wy: number): CanvasObject | null => {
    const effectiveHalfWidth = (o: CanvasObject): number => {
      if ('width' in o) return geoRoadWidthPx(o as { width: number; realWidth?: number }, mapCenter) / 2 + 6;
      return 6;
    };
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.type === "taper") {
        const storedTaperLength = (o as TaperObject).taperLength;
        const effectiveTaperLength =
          typeof storedTaperLength === "number" && Number.isFinite(storedTaperLength) && storedTaperLength > 0
            ? storedTaperLength
            : calcTaperLength(o.speed, o.laneWidth, o.numLanes);
        const taperHitRadius = Math.max(30, Math.min(effectiveTaperLength * TAPER_SCALE / 2, 150));
        if (dist(wx, wy, o.x, o.y) < taperHitRadius) return o;
      } else if (o.type === "turn_lane") {
        // Hit within bounding radius (taper+run length / 2) capped to reasonable range
        const totalLen = o.taperLength + o.runLength;
        const hitRadius = Math.max(30, Math.min(totalLen / 2, 150));
        if (dist(wx, wy, o.x, o.y) < hitRadius) return o;
      } else if (o.type === "sign" || o.type === "device" || o.type === "text") {
        if (dist(wx, wy, o.x, o.y) < 30) return o;
      }
      if (o.type === "zone") {
        if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) return o;
      }
      if (o.type === "road" || o.type === "arrow" || o.type === "measure") {
        const d1 = dist(wx, wy, o.x1, o.y1), d2 = dist(wx, wy, o.x2, o.y2);
        const segLen = dist(o.x1, o.y1, o.x2, o.y2);
        if (d1 + d2 < segLen + effectiveHalfWidth(o)) return o;
      }
      if (o.type === "lane_mask") {
        const d1 = dist(wx, wy, o.x1, o.y1), d2 = dist(wx, wy, o.x2, o.y2);
        const segLen = dist(o.x1, o.y1, o.x2, o.y2);
        if (d1 + d2 < segLen + o.laneWidth / 2 + 6) return o;
      }
      if (o.type === "crosswalk") {
        // Distance from click to the crosswalk center axis (x1y1→x2y2)
        const cwDx = o.x2 - o.x1, cwDy = o.y2 - o.y1;
        const cwLenSq = cwDx * cwDx + cwDy * cwDy;
        const cwT = cwLenSq === 0 ? 0 : Math.max(0, Math.min(1, ((wx - o.x1) * cwDx + (wy - o.y1) * cwDy) / cwLenSq));
        const cwCx = o.x1 + cwT * cwDx, cwCy = o.y1 + cwT * cwDy;
        if (dist(wx, wy, cwCx, cwCy) < o.depth / 2 + 5) return o;
      }
      if (o.type === "polyline_road" && o.points?.length >= 2) {
        if (distToPolyline(wx, wy, o.points) < effectiveHalfWidth(o)) return o;
      }
      if (o.type === "curve_road" && o.points?.length === 3) {
        const sampledPts = sampleBezier(o.points[0], o.points[1], o.points[2], 20);
        if (distToPolyline(wx, wy, sampledPts) < effectiveHalfWidth(o)) return o;
      }
      if (o.type === "cubic_bezier_road" && o.points?.length === 4) {
        const sampledPts = sampleCubicBezier(o.points[0], o.points[1], o.points[2], o.points[3], 20);
        if (distToPolyline(wx, wy, sampledPts) < effectiveHalfWidth(o)) return o;
      }
    }
    return null;
  }, [objects, mapCenter]);

  // Mouse handlers — e.button/clientX/deltaY accessed via e.evt (Konva wraps native events)
  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const raw = toWorld();
    const { x, y, snapped } = trySnap(raw.x, raw.y);
    setCursorPos(raw);
    setSnapIndicator(snapped ? { x, y } : null);

    if (tool === "pan" || e.evt.button === 1) {
      setIsPanning(true);
      const pos = stageRef.current?.getPointerPosition();
      if (pos) setPanStart({ x: pos.x - offset.x, y: pos.y - offset.y });
      return;
    }

    if (tool === "select") {
      // Check if click is near a handle of the currently selected cubic bezier road
      if (selected) {
        const selObj = objects.find((o) => o.id === selected);
        if (selObj?.type === "cubic_bezier_road") {
          const handleRadius = Math.min(10 / zoom, 20);
          for (let i = 0; i < selObj.points.length; i++) {
            const p = selObj.points[i];
            if (dist(raw.x, raw.y, p.x, p.y) < handleRadius) {
              setDrawStart({
                x: raw.x, y: raw.y,
                id: selObj.id,
                handleIndex: i,
                origPoints: selObj.points.map((pt) => ({ ...pt })),
              });
              return;
            }
          }
        }
      }
      const hit = hitTest(raw.x, raw.y);
      setSelected(hit ? hit.id : null);
      if (hit) {
        setDrawStart({
          x: raw.x, y: raw.y,
          ox: isPointObject(hit) ? hit.x : isLineObject(hit) ? hit.x1 : 0,
          oy: isPointObject(hit) ? hit.y : isLineObject(hit) ? hit.y1 : 0,
          id: hit.id,
          origPoints: isMultiPointRoad(hit) ? hit.points.map((p) => ({ ...p })) : null,
        });
      }
      return;
    }

    if (tool === "erase") {
      const hit = hitTest(raw.x, raw.y);
      if (hit) {
        const newObjs = objects.filter((o) => o.id !== hit.id);
        setObjects(newObjs); pushHistory(newObjs); setSelected(null);
      }
      return;
    }

    if (tool === "sign") {
      const newSign: SignObject = { id: uid(), type: "sign", x: raw.x, y: raw.y, signData: selectedSign, rotation: 0, scale: 1 };
      const newObjs = [...objects, newSign];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newSign.id);
      if (selectedSign) {
        const isCustom = selectedSign.id.startsWith('custom_');
        track('sign_placed', {
          sign_id: selectedSign.id,
          sign_source: isCustom ? 'custom' : 'builtin',
          ...(isCustom ? {} : { sign_label: selectedSign.label }),
        });
      }
      return;
    }

    if (tool === "device") {
      const newDev: DeviceObject = { id: uid(), type: "device", x: raw.x, y: raw.y, deviceData: selectedDevice, rotation: 0 };
      const newObjs = [...objects, newDev];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newDev.id);
      return;
    }

    if (tool === "taper") {
      const speed = 45, laneWidth = 12;
      const newTaper: TaperObject = { id: uid(), type: "taper", x: raw.x, y: raw.y, rotation: 0, speed, laneWidth, taperLength: calcTaperLength(speed, laneWidth), manualLength: false, numLanes: 1 };
      const newObjs = [...objects, newTaper];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newTaper.id);
      return;
    }

    if (tool === "turn_lane") {
      const newTL: TurnLaneObject = { id: uid(), type: "turn_lane", x: raw.x, y: raw.y, rotation: 0, laneWidth: 20, taperLength: 80, runLength: 100, side: 'right', turnDir: 'right' };
      const newObjs = [...objects, newTL];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newTL.id);
      return;
    }

    if (tool === "text") {
      const textVal = prompt("Enter text label:");
      if (textVal) {
        const newText: TextObject = { id: uid(), type: "text", x: raw.x, y: raw.y, text: textVal, fontSize: 14, bold: false, color: "#ffffff" };
        const newObjs = [...objects, newText];
        setObjects(newObjs); pushHistory(newObjs); setSelected(newText.id);
      }
      return;
    }

    if (tool === "road") {
      if (roadDrawMode === "straight") {
        setDrawStart({ x, y });
        return;
      }

      if (roadDrawMode === "poly" || roadDrawMode === "smooth") {
        const now = Date.now();
        const last = lastClickPosRef.current;
        const isDouble = (now - lastClickTimeRef.current < 350) && last && dist(x, y, last.x, last.y) < 15 / zoom;
        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x, y };

        if (isDouble && polyPoints.length >= 2) {
          const newRoad: PolylineRoadObject = { id: uid(), type: "polyline_road", points: [...polyPoints], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id, smooth: roadDrawMode === "smooth" };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setPolyPoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: roadDrawMode, point_count: polyPoints.length });
        } else {
          setPolyPoints((prev) => [...prev, { x, y }]);
        }
        return;
      }

      if (roadDrawMode === "curve") {
        const newCurvePts = [...curvePoints, { x, y }];
        if (newCurvePts.length === 3) {
          const newRoad: CurveRoadObject = { id: uid(), type: "curve_road", points: newCurvePts as [Point, Point, Point], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setCurvePoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: 'curve', point_count: 3 });
        } else {
          setCurvePoints(newCurvePts);
        }
        return;
      }

      if (roadDrawMode === "cubic") {
        const newCubicPts = [...cubicPoints, { x, y }];
        if (newCubicPts.length === 4) {
          const newRoad: CubicBezierRoadObject = { id: uid(), type: "cubic_bezier_road", points: newCubicPts as [Point, Point, Point, Point], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setCubicPoints([]);
          track('road_drawn', { road_type: selectedRoadType.id, draw_mode: 'cubic', point_count: 4 });
        } else {
          setCubicPoints(newCubicPts);
        }
        return;
      }
    }

    if (tool === "intersection") {
      const roads = createIntersectionRoads(x, y, intersectionType, selectedRoadType);
      const newObjs = [...objects, ...roads];
      setObjects(newObjs); pushHistory(newObjs); setSelected(roads[roads.length - 1].id);
      track('road_drawn', { road_type: selectedRoadType.id, draw_mode: intersectionType === '4way' ? 'intersection_4way' : 'intersection_t' });
      return;
    }

    if (["zone", "arrow", "measure", "lane_mask", "crosswalk"].includes(tool)) {
      setDrawStart({ x: raw.x, y: raw.y });
    }
  }, [tool, roadDrawMode, intersectionType, toWorld, trySnap, hitTest, offset, objects, selected, selectedSign, selectedDevice, selectedRoadType, polyPoints, curvePoints, cubicPoints, pushHistory, zoom]);

  const handleMouseMove = useCallback((_e: KonvaEventObject<MouseEvent>) => {
    const raw = toWorld();
    setCursorPos(raw);

    if ((tool === "road" || tool === "intersection") && snapEnabled) {
      const { x, y, snapped } = snapToEndpoint(raw.x, raw.y, objects, SNAP_RADIUS, zoom);
      setSnapIndicator(snapped ? { x, y } : null);
    } else {
      setSnapIndicator(null);
    }

    if (isPanning && panStart) {
      const pos = stageRef.current?.getPointerPosition();
      if (pos) {
        const newOffset = { x: pos.x - panStart.x, y: pos.y - panStart.y };
        const dox = newOffset.x - offset.x;
        const doy = newOffset.y - offset.y;
        setOffset(newOffset);
        // Shift map tiles to follow the pan. Tiles live in screen space (Layer 1,
        // no Konva transform), so 1 screen pixel == 1 tile pixel: shift mapCenter
        // by (-dox, -doy) in tile pixel space and convert back to lat/lon.
        if (mapCenter) {
          const { x: cx, y: cy } = latLonToPixel(mapCenter.lat, mapCenter.lon, mapCenter.zoom);
          const { lat: newLat, lon: newLon } = pixelToLatLon(cx - dox, cy - doy, mapCenter.zoom);
          setMapCenter({ lat: newLat, lon: newLon, zoom: mapCenter.zoom });
        }
      }
      return;
    }

    if (tool === "select" && drawStart && drawStart.id) {
      const dx = raw.x - drawStart.x, dy = raw.y - drawStart.y;
      setObjects((prev) => prev.map((o) => {
        if (o.id !== drawStart.id) return o;
        if (o.type === "cubic_bezier_road" && drawStart.origPoints) {
          if (drawStart.handleIndex != null) {
            // Drag a single handle
            const newPoints = drawStart.origPoints.map((p, i) =>
              i === drawStart.handleIndex ? { x: p.x + dx, y: p.y + dy } : { ...p }
            ) as [Point, Point, Point, Point];
            return { ...o, points: newPoints };
          }
          // Drag whole object
          return { ...o, points: drawStart.origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) as [Point, Point, Point, Point] };
        }
        if ((o.type === "polyline_road" || o.type === "curve_road") && drawStart.origPoints) {
          return { ...o, points: drawStart.origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) } as CanvasObject;
        }
        if (isPointObject(o)) {
          return { ...o, x: (drawStart.ox ?? 0) + dx, y: (drawStart.oy ?? 0) + dy } as CanvasObject;
        }
        if (isLineObject(o)) {
          const sdx = o.x2 - o.x1, sdy = o.y2 - o.y1;
          return { ...o, x1: (drawStart.ox ?? 0) + dx, y1: (drawStart.oy ?? 0) + dy, x2: (drawStart.ox ?? 0) + dx + sdx, y2: (drawStart.oy ?? 0) + dy + sdy } as CanvasObject;
        }
        return o;
      }));
    }
  }, [isPanning, panStart, toWorld, tool, drawStart, snapEnabled, objects, zoom, offset, mapCenter, setMapCenter]);

  const handleMouseUp = useCallback((_e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) { setIsPanning(false); setPanStart(null); return; }

    if (tool === "select" && drawStart && drawStart.id) {
      pushHistory(objects); setDrawStart(null); return;
    }

    if (drawStart && tool === "road" && roadDrawMode === "straight") {
      const raw = toWorld();
      const { x, y } = trySnap(raw.x, raw.y);
      const d = dist(drawStart.x, drawStart.y, x, y);
      if (d < 5) { setDrawStart(null); return; }
      const newRoad: StraightRoadObject = { id: uid(), type: "road", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
      const newObjs = [...objects, newRoad];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id);
      track('road_drawn', { road_type: selectedRoadType.id, draw_mode: 'straight' });
      setDrawStart(null);
      return;
    }

    if (drawStart && ["zone", "arrow", "measure", "lane_mask", "crosswalk"].includes(tool)) {
      const { x, y } = toWorld();
      const d = dist(drawStart.x, drawStart.y, x, y);
      if (d < 5) { setDrawStart(null); return; }

      let newObj: CanvasObject | undefined;
      if (tool === "zone") {
        const zx = Math.min(drawStart.x, x), zy = Math.min(drawStart.y, y);
        newObj = { id: uid(), type: "zone", x: zx, y: zy, w: Math.abs(x - drawStart.x), h: Math.abs(y - drawStart.y) };
      } else if (tool === "arrow") {
        newObj = { id: uid(), type: "arrow", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, color: "#fff" };
      } else if (tool === "measure") {
        newObj = { id: uid(), type: "measure", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y };
      } else if (tool === "lane_mask") {
        newObj = { id: uid(), type: "lane_mask", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, laneWidth: 20, color: "rgba(239,68,68,0.5)", style: "hatch" };
      } else if (tool === "crosswalk") {
        newObj = { id: uid(), type: "crosswalk", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, depth: 24, stripeCount: 6, stripeColor: "#ffffff" };
      }

      if (newObj) {
        const newObjs = [...objects, newObj];
        setObjects(newObjs); pushHistory(newObjs); setSelected(newObj.id);
      }
      setDrawStart(null);
    }
  }, [isPanning, drawStart, tool, roadDrawMode, toWorld, trySnap, objects, selectedRoadType, pushHistory]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const mx = pos.x, my = pos.y;
    const factor = e.evt.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    setZoom(newZoom);
    setOffset({ x: mx - ((mx - offset.x) / zoom) * newZoom, y: my - ((my - offset.y) / zoom) * newZoom });
  }, [zoom, offset]);

  // Object helpers
  const updateObject = (id: string, updates: Record<string, unknown>) => {
    const newObjs = objects.map((o) => (o.id === id ? { ...o, ...updates } as CanvasObject : o));
    setObjects(newObjs); pushHistory(newObjs);
  };

  const deleteObject = (id: string) => {
    const newObjs = objects.filter((o) => o.id !== id);
    setObjects(newObjs); pushHistory(newObjs); setSelected(null);
  };

  const reorderObject = (id: string, dir: "front" | "forward" | "backward" | "back") => {
    const idx = objects.findIndex(o => o.id === id);
    if (idx === -1) return;
    // Short-circuit no-ops so we don't clone or push redundant history entries
    if ((dir === "front" || dir === "forward") && idx === objects.length - 1) return;
    if ((dir === "back"  || dir === "backward") && idx === 0) return;
    const next = [...objects];
    const [obj] = next.splice(idx, 1);
    if (dir === "front")         next.push(obj);
    else if (dir === "back")     next.unshift(obj);
    else if (dir === "forward")  next.splice(idx + 1, 0, obj);
    else                         next.splice(idx - 1, 0, obj);
    setObjects(next);
    pushHistory(next);
  };

  const clearAll = () => {
    if (confirm("Clear all objects?")) { setObjects([]); pushHistory([]); setSelected(null); }
  };

  const newPlan = () => {
    if (objects.length > 0 && !confirm("Start a new plan? Unsaved changes will be lost.")) return;
    localStorage.removeItem(AUTOSAVE_KEY);
    setObjects([]); pushHistory([]); setSelected(null);
    setPlanTitle("Untitled Traffic Control Plan");
    setPlanId(uid());
    setPlanCreatedAt(new Date().toISOString());
    setPlanMeta({ projectNumber: "", client: "", location: "", notes: "" });
    setMapCenter(null);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleTemplateApply = useCallback((templateObjects: CanvasObject[], mode: 'replace' | 'merge') => {
    // Reset any in-progress draw state so partial roads don't persist after apply
    setDrawStart(null);
    setPolyPoints([]);
    setCurvePoints([]);
    setCubicPoints([]);
    setSnapIndicator(null);
    if (mode === 'replace') {
      setObjects(templateObjects);
      pushHistory(templateObjects);
      setSelected(null);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    } else {
      const merged = [...objects, ...templateObjects];
      setObjects(merged);
      pushHistory(merged);
      setSelected(null);
    }
    // track is a stable module-level import — intentionally omitted from deps
    track('template_applied', { mode, object_count: templateObjects.length });
  }, [objects, pushHistory]);

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  };

  const safePlanTitle =
    planTitle
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "plan";

  const savePlan = () => {
    const plan = {
      id: planId,
      name: planTitle,
      createdAt: planCreatedAt,
      updatedAt: new Date().toISOString(),
      userId: userId,
      mapCenter: mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lon, zoom: mapCenter.zoom } : null,
      canvasOffset: offset,
      canvasZoom: zoom,
      canvasState: { objects },
      metadata: planMeta,
    };
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${safePlanTitle}.tcp.json`);
    URL.revokeObjectURL(url);
    track('plan_saved_local', { object_count: objects.length });
  };

  const handleCloudSave = async () => {
    if (!userId || cloudSaveStatus === 'Saving…') return;
    setCloudSaveStatus('Saving…');
    try {
      const objectCount = objects.length;
      const data = {
        id: planId, name: planTitle, createdAt: planCreatedAt,
        updatedAt: new Date().toISOString(), userId,
        canvasState: { objects }, metadata: planMeta,
        canvasOffset: offset, canvasZoom: zoom, mapCenter,
      };
      await savePlanToCloud(userId, planId, data);
      setCloudSaveStatus('Saved ✓');
      track('plan_saved_cloud', { object_count: objectCount });
    } catch (e) {
      setCloudSaveStatus(e instanceof Error ? e.message : 'Save failed');
    }
    setTimeout(() => setCloudSaveStatus(null), 3000);
  };

  const handleDashboardOpen = (data: Record<string, unknown>) => {
    const cs = data.canvasState as { objects?: CanvasObject[] } | undefined;
    const newObjects = cs?.objects ?? [];
    const newId = (data.id as string | undefined) ?? uid();
    const newTitle = (data.name as string | undefined) ?? 'Untitled Traffic Control Plan';
    const newCreatedAt = (data.createdAt as string | undefined) ?? new Date().toISOString();
    const newMeta = (data.metadata as PlanMeta | undefined) ?? { projectNumber: '', client: '', location: '', notes: '' };
    const newOffset = (data.canvasOffset as Point | undefined) ?? { x: 0, y: 0 };
    const newZoom = typeof data.canvasZoom === 'number' ? data.canvasZoom : 1;
    const rawMC = data.mapCenter as { lat: number; lng?: number; lon?: number; zoom: number } | null | undefined;
    const rawLon = rawMC?.lng ?? rawMC?.lon;
    const newMapCenter: MapCenter | null = rawMC != null && rawLon != null ? { lat: rawMC.lat, lon: rawLon, zoom: rawMC.zoom } : null;
    setPlanId(newId);
    setPlanTitle(newTitle);
    setPlanCreatedAt(newCreatedAt);
    setPlanMeta(newMeta);
    setObjects(newObjects);
    setHistory([newObjects]);
    setHistoryIndex(0);
    setSelected(null);
    setOffset(newOffset);
    setZoom(newZoom);
    setMapCenter(newMapCenter);
    setShowDashboard(false);
    track('plan_loaded_cloud', { object_count: newObjects.length });
  };

  const exportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = stage.toCanvas({ pixelRatio: 2 });
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${safePlanTitle}.png`);
      URL.revokeObjectURL(url);
      track('plan_exported_png', { object_count: objects.length });
    }, "image/png");
  };

  const exportPDF = () => {
    if (!userId && onRequestSignIn) {
      onRequestSignIn();
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = stage.toCanvas({ pixelRatio: 2 });
    const b64 = canvas.toDataURL("image/png").replace("data:image/png;base64,", "");
    const payload = {
      id: planId,
      name: planTitle,
      createdAt: planCreatedAt,
      updatedAt: new Date().toISOString(),
      userId: userId,
      mapCenter: mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lon, zoom: mapCenter.zoom } : null,
      canvasOffset: offset,
      canvasZoom: zoom,
      canvasState: { objects },
      metadata: planMeta,
      canvas_image_b64: b64,
    };
    setExportPreview(payload);
  };

  const confirmExportPDF = async () => {
    if (!exportPreview) return;
    const apiBase = (import.meta.env.VITE_EXPORT_API_BASE ?? "").replace(/\/$/, "");
    try {
      const res = await fetch(`${apiBase}/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPreview),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${safePlanTitle}.pdf`);
      URL.revokeObjectURL(url);
      pdfExportedRef.current = true;
      track('plan_exported_pdf', { object_count: objects.length });
    } catch (err) {
      console.error("PDF export failed:", err);
      throw err; // re-throw so the modal stays open on failure
    }
  };

  const loadPlan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent<FileReader>) => {
      try {
        const plan = JSON.parse(evt.target!.result as string);
        setPlanTitle(plan.name || "Untitled Traffic Control Plan");
        setPlanId(plan.id || uid());
        setPlanCreatedAt(plan.createdAt || new Date().toISOString());
        setPlanMeta(plan.metadata || { projectNumber: "", client: "", location: "", notes: "" });
        if (plan.mapCenter) setMapCenter({ lat: plan.mapCenter.lat, lon: plan.mapCenter.lng, zoom: plan.mapCenter.zoom });
        if (plan.canvasOffset) setOffset(plan.canvasOffset);
        if (plan.canvasZoom) setZoom(plan.canvasZoom);
        const loaded: CanvasObject[] = plan.canvasState?.objects || [];
        setObjects(loaded); pushHistory(loaded); setSelected(null);
      } catch {
        alert("Failed to load plan. Make sure it's a valid .tcp.json file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2));
  const zoomFit = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const doAddressSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true); setSearchStatus("");
    try {
      const results = await geocodeAddress(searchQuery);
      setSearchResults(results); setSearchOpen(true);
      if (!results.length) { setSearchStatus("No matches found."); return; }
      selectAddressResult(results[0]);
    } catch {
      setSearchStatus("Address lookup failed. Try again."); setSearchResults([]); setSearchOpen(true);
    } finally { setSearchLoading(false); }
  };

  const selectAddressResult = (result: GeocodeResult) => {
    setSearchQuery(formatSearchPrimary(result));
    const lat = Number(result?.lat), lon = Number(result?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      setMapCenter({ lat, lon, zoom: 16 }); setOffset({ x: 0, y: 0 }); setZoom(1);
      setSearchStatus(`Centered on ${formatSearchPrimary(result)}`);
    } else { setSearchStatus("Selected result has no coordinates."); }
    setSearchOpen(false);
  };

  const isSearchError = searchStatus.startsWith("Address lookup failed") || searchStatus.startsWith("No matches") || searchStatus.startsWith("Selected result");

  const polyInProgress = tool === "road" && (roadDrawMode === "poly" || roadDrawMode === "smooth") && polyPoints.length > 0;
  const curveInProgress = tool === "road" && roadDrawMode === "curve" && curvePoints.length > 0;
  const cubicInProgress = tool === "road" && roadDrawMode === "cubic" && cubicPoints.length > 0;

  // suppress mapRenderTick lint warning — used to trigger re-render when tiles load
  void mapRenderTick;

  // Pre-compute sign search results so JSX stays readable
  const signSearchResults: { sign: SignData; catLabel: string; catColor: string }[] = (() => {
    const q = signSearch.trim()
    if (!q) return []
    const nq = normalizeForSearch(q)
    const builtIn = Object.entries(SIGN_CATEGORIES).flatMap(([, cat]) =>
      cat.signs
        .filter(s => normalizeForSearch(s.label).includes(nq) || (s.mutcd && normalizeForSearch(s.mutcd).includes(nq)))
        .map(s => ({ sign: s, catLabel: cat.label, catColor: cat.color }))
    )
    const custom = customSigns
      .filter(s => normalizeForSearch(s.label).includes(nq))
      .map(s => ({ sign: s, catLabel: "Custom", catColor: COLORS.textMuted }))
    return [...builtIn, ...custom]
  })()

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: COLORS.bg, color: COLORS.text, fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", overflow: "hidden", userSelect: "none" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      {/* ─── PRE-BETA BANNER ─── */}
      {!bannerDismissed && (
        <div data-testid="prebeta-banner" style={{ background: "rgba(245,158,11,0.15)", borderBottom: `1px solid rgba(245,158,11,0.35)`, padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: COLORS.accent }}>
            🚧 <strong>Pre-Beta</strong> — expect bugs and breaking changes. &nbsp;
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: COLORS.accent, textDecoration: "underline" }}>Report an issue</a>
          </span>
          <button onClick={dismissBanner} data-testid="dismiss-banner" style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 4px" }} title="Dismiss">✕</button>
        </div>
      )}

      {/* ─── TOP BAR ─── */}
      <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel, flexShrink: 0, gap: 12 }}>
        <div data-testid="toolbar" style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 320px", minWidth: 0, overflow: "hidden" }}>
          <a href="/" data-testid="home-link" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }} title="Back to home">
            <span style={{ fontSize: 20, color: COLORS.accent }}>◆</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, letterSpacing: 1 }}>TCP</span>
          </a>
          <div style={{ width: 1, height: 24, background: COLORS.panelBorder }} />
          <input
            data-testid="plan-title"
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            style={{ background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontWeight: 500, width: 220, padding: "4px 8px", borderRadius: 4, fontFamily: "inherit" }}
          />
          <div style={{ width: 1, height: 24, background: COLORS.panelBorder }} />
          <button onClick={newPlan} style={panelBtnStyle(false)} title="New plan">New</button>
          <button onClick={() => fileInputRef.current?.click()} style={panelBtnStyle(false)} title="Open .tcp.json">Open</button>
          <button onClick={savePlan} style={{ ...panelBtnStyle(false), background: COLORS.accentDim, color: COLORS.accent, borderColor: "rgba(245,158,11,0.35)" }} title="Download plan as .tcp.json">↓ Save</button>
          <button onClick={() => setShowTemplatePicker(true)} data-testid="templates-button" style={panelBtnStyle(false)} title="Start from a template">Templates</button>
          {userId && CLOUD_ENABLED && (<>
            <button onClick={handleCloudSave} data-testid="cloud-save-button" style={{ ...panelBtnStyle(false), background: COLORS.accentDim, color: COLORS.accent, borderColor: "rgba(245,158,11,0.35)" }} title="Save plan to cloud (S3)">☁ Save{cloudSaveStatus ? ` — ${cloudSaveStatus}` : ''}</button>
            <button onClick={() => setShowDashboard(true)} data-testid="cloud-plans-button" style={panelBtnStyle(false)} title="Open a plan from cloud">☁ Plans</button>
          </>)}
          <button onClick={exportPNG} data-testid="export-png-button" style={{ ...panelBtnStyle(false), background: COLORS.accentDim, color: COLORS.accent, borderColor: "rgba(245,158,11,0.35)" }} title="Export canvas as PNG (2×)">↓ PNG</button>
          <input ref={fileInputRef} type="file" accept=".json,.tcp.json" onChange={loadPlan} style={{ display: "none" }} />
        </div>

        {/* ── Export PDF — always visible, primary CTA ── */}
        <button
          onClick={() => { if (!pdfSeen) { sessionStorage.setItem(PDF_SEEN_KEY, '1'); setPdfSeen(true); } exportPDF(); }}
          data-testid="export-pdf-button"
          title="Export plan as PDF"
          style={{
            flexShrink: 0,
            background: "#1A6EFF", color: "#fff", border: "2px solid #1A6EFF",
            borderRadius: 6, fontSize: 12, fontWeight: 700, padding: "8px 16px",
            cursor: "pointer", letterSpacing: "0.3px", whiteSpace: "nowrap",
            fontFamily: "inherit",
            boxShadow: pdfSeen ? "none" : "0 0 0 3px rgba(26,110,255,0.35)",
            animation: pdfSeen ? "none" : "tcp-pdf-pulse 1.8s ease-in-out 3",
          }}
        >⬇ Export PDF</button>

        {/* Right-side user controls — flexShrink:0 so toolbar overflow never pushes these off screen */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderLeft: `1px solid ${COLORS.panelBorder}`, paddingLeft: 12, marginLeft: 4 }}>
          <button onClick={() => setShowHelp(true)} data-testid="help-button" style={panelBtnStyle(false)} title="Help — keyboard shortcuts &amp; tool guide (?)">? Help</button>
          <button onClick={() => {
            const params = new URLSearchParams();
            if (userId) params.set('uid', userId);
            if (userEmail) params.set('email', userEmail);
            const qs = params.toString();
            window.open(`/feedback.html${qs ? `?${qs}` : ''}`, '_blank', 'noopener,noreferrer');
          }} style={panelBtnStyle(false)} title="Report an issue or submit feedback">Report Issue</button>
          {onSignOut && (
            <button onClick={onSignOut} data-testid="sign-out-button" style={{ ...panelBtnStyle(false), display: "flex", alignItems: "center", gap: 5 }} title={userEmail ?? userId ?? 'Signed in'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Sign Out
            </button>
          )}
        </div>

        <div style={{ position: "relative", flex: "0 1 300px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={searchInputRef}
              data-testid="address-search-input"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchStatus(""); }}
              onKeyDown={(e) => e.key === "Enter" && doAddressSearch()}
              placeholder={mapCenter ? "Search address…" : "Enter job site address to load the map"}
              style={{ flex: 1, padding: "5px 10px", fontSize: 11, background: COLORS.bg, border: `1px solid ${mapCenter ? COLORS.panelBorder : "rgba(245,158,11,0.6)"}`, color: COLORS.text, borderRadius: 5, fontFamily: "inherit", outline: "none", animation: mapCenter ? "none" : "tcp-addr-pulse 1.5s ease-in-out infinite" }}
            />
            <button onClick={doAddressSearch} style={{ ...panelBtnStyle(false), background: COLORS.accentDim, color: COLORS.accent, borderColor: "rgba(245,158,11,0.35)", whiteSpace: "nowrap" }}>
              {searchLoading ? "…" : "🔍 Go"}
            </button>
          </div>
          {searchStatus && <div style={{ marginTop: 4, fontSize: 9, color: isSearchError ? COLORS.danger : COLORS.textDim }}>{searchStatus}</div>}
          {searchOpen && searchResults.length > 0 && (
            <div style={{ position: "absolute", top: 34, left: 0, right: 0, background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, zIndex: 999, maxHeight: 240, overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
              {searchResults.map((result, index) => (
                <div key={index} onClick={() => selectAddressResult(result)}
                  style={{ padding: "7px 12px", fontSize: 10, color: COLORS.text, cursor: "pointer", borderBottom: `1px solid ${COLORS.panelBorder}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.accentDim; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ fontWeight: 500 }}>{formatSearchPrimary(result)}</div>
                  <div style={{ fontSize: 8, color: COLORS.textDim, marginTop: 1 }}>{result.display_name}</div>
                </div>
              ))}
              <div onClick={() => setSearchOpen(false)} style={{ padding: "5px", fontSize: 9, color: COLORS.textDim, cursor: "pointer", textAlign: "center" }}>Hide results</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={undo} style={panelBtnStyle(false)} title="Undo (Ctrl+Z)" data-testid="undo-button">↶ Undo</button>
          <button onClick={redo} style={panelBtnStyle(false)} title="Redo (Ctrl+Shift+Z)" data-testid="redo-button">↷ Redo</button>
          <div style={{ width: 1, height: 20, background: COLORS.panelBorder }} />
          <button onClick={clearAll} style={{ ...panelBtnStyle(false), color: COLORS.danger, borderColor: "rgba(239,68,68,0.3)" }}>Clear All</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ─── LEFT PANEL ─── */}
        <div style={{ width: 260, background: COLORS.panel, borderRight: `1px solid ${COLORS.panelBorder}`, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
            {["tools", "signs", "devices", "roads"].map((tab) => (
              <button key={tab} onClick={() => setLeftPanel(tab)}
                style={{ flex: 1, padding: "8px 0", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, background: leftPanel === tab ? COLORS.accentDim : "transparent", color: leftPanel === tab ? COLORS.accent : COLORS.textDim, border: "none", borderBottom: leftPanel === tab ? `2px solid ${COLORS.accent}` : "2px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>

            {leftPanel === "tools" && (
              <>
                {sectionTitle("Drawing Tools")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {TOOLS.map((t) => (
                    <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => requestTool(t.id)} />
                  ))}
                </div>

                {sectionTitle("Canvas")}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} style={{ accentColor: COLORS.accent }} />
                    Show Grid
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={showNorthArrow} onChange={(e) => setShowNorthArrow(e.target.checked)} style={{ accentColor: COLORS.accent }} data-testid="north-arrow-toggle" />
                    North Arrow
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} style={{ accentColor: COLORS.accent }} data-testid="legend-toggle" />
                    Legend Box
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} style={{ accentColor: COLORS.accent }} />
                    Snap to Endpoints
                  </label>
                </div>

                {sectionTitle("Zoom")}
                <div style={{ display: "flex", gap: 4 }}>
                  <button data-testid="zoom-out" onClick={zoomOut} style={panelBtnStyle(false)}>−</button>
                  <div data-testid="zoom-level" style={{ flex: 1, textAlign: "center", fontSize: 11, color: COLORS.text, lineHeight: "28px" }}>{(zoom * 100).toFixed(0)}%</div>
                  <button data-testid="zoom-in" onClick={zoomIn} style={panelBtnStyle(false)}>+</button>
                  <button onClick={zoomFit} style={panelBtnStyle(false)}>Fit</button>
                </div>

                {sectionTitle("Objects")}
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{objects.length} objects on canvas</div>

                {sectionTitle("Mini Map")}
                <MiniMap objects={objects} canvasSize={canvasSize} zoom={zoom} offset={offset} mapCenter={mapCenter} />
              </>
            )}

            {leftPanel === "signs" && (
              <>
                <div style={{ display: "flex", gap: 0, marginBottom: 8, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
                  {["library", "editor"].map((tab) => (
                    <button key={tab} onClick={() => setSignSubTab(tab)}
                      style={{ flex: 1, padding: "7px 0", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, background: signSubTab === tab ? COLORS.accentDim : "transparent", color: signSubTab === tab ? COLORS.accent : COLORS.textDim, border: "none", borderBottom: signSubTab === tab ? `2px solid ${COLORS.accent}` : "2px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>
                      {tab === "library" ? "📚 Library" : "✏ Editor"}
                    </button>
                  ))}
                </div>

                {signSubTab === "library" && (
                  <>
                    {/* Search input */}
                    <input
                      type="text"
                      aria-label="Search signs by name or MUTCD code"
                      placeholder="Search by name or MUTCD code…"
                      value={signSearch}
                      onChange={e => setSignSearch(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "5px 8px", fontSize: 11, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 4, color: COLORS.text, outline: "none" }}
                    />

                    {signSearch.trim() ? (
                      /* ── Search results ── */
                      <>
                        {signSearchResults.length === 0 ? (
                          <div style={{ fontSize: 11, color: COLORS.textDim, textAlign: "center", padding: "16px 0" }}>No signs found</div>
                        ) : (
                          <>
                            {sectionTitle(`${signSearchResults.length} result${signSearchResults.length !== 1 ? "s" : ""}`)}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                              {signSearchResults.map(({ sign, catLabel, catColor }) => (
                                <button key={sign.id} onClick={() => { setSelectedSign(sign); requestTool("sign"); }}
                                  style={{ padding: "10px 6px", background: selectedSign?.id === sign.id && tool === "sign" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: selectedSign?.id === sign.id && tool === "sign" ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`, borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: sign.shape === "circle" ? "50%" : sign.shape === "diamond" ? 0 : 4, background: sign.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: sign.textColor, border: sign.border ? `2px solid ${sign.border}` : "none", transform: sign.shape === "diamond" ? "rotate(45deg)" : "none" }}>
                                    <span style={{ transform: sign.shape === "diamond" ? "rotate(-45deg)" : "none", fontSize: 8 }}>{sign.label.slice(0, 3)}</span>
                                  </div>
                                  <span style={{ fontSize: 8, color: COLORS.textMuted, textAlign: "center" }}>{sign.label}</span>
                                  {sign.mutcd && <span style={{ fontSize: 7, color: catColor, opacity: 0.8 }}>{sign.mutcd}</span>}
                                  <span style={{ fontSize: 7, color: COLORS.textDim }}>{catLabel}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      /* ── Browse by category ── */
                      <>
                    {sectionTitle("Sign Category")}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {Object.entries(SIGN_CATEGORIES).map(([key, cat]) => (
                        <button key={key} onClick={() => setSignCategory(key)}
                          style={{ ...panelBtnStyle(signCategory === key), borderColor: signCategory === key ? cat.color : COLORS.panelBorder, color: signCategory === key ? cat.color : COLORS.textMuted, background: signCategory === key ? `${cat.color}15` : "transparent" }}>
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {sectionTitle("Signs")}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                      {SIGN_CATEGORIES[signCategory].signs.map((sign) => (
                        <button key={sign.id} onClick={() => { setSelectedSign(sign); requestTool("sign"); }}
                          style={{ padding: "10px 6px", background: selectedSign?.id === sign.id && tool === "sign" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: selectedSign?.id === sign.id && tool === "sign" ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`, borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 28, height: 28, borderRadius: sign.shape === "circle" ? "50%" : sign.shape === "diamond" ? 0 : 4, background: sign.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: sign.textColor, border: sign.border ? `2px solid ${sign.border}` : "none", transform: sign.shape === "diamond" ? "rotate(45deg)" : "none" }}>
                            <span style={{ transform: sign.shape === "diamond" ? "rotate(-45deg)" : "none", fontSize: 8 }}>{sign.label.slice(0, 3)}</span>
                          </div>
                          <span style={{ fontSize: 8, color: COLORS.textMuted, textAlign: "center" }}>{sign.label}</span>
                        </button>
                      ))}
                    </div>
                      </>
                    )}
                    {customSigns.length > 0 && (
                      <>
                        {sectionTitle("My Custom Signs")}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                          {customSigns.map((sign) => (
                            <div key={sign.id} style={{ position: "relative" }}>
                              <button onClick={() => { setSelectedSign(sign); requestTool("sign"); }}
                                style={{ width: "100%", padding: "10px 6px", background: selectedSign?.id === sign.id && tool === "sign" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: selectedSign?.id === sign.id && tool === "sign" ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`, borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 28, height: 28, borderRadius: sign.shape === "circle" ? "50%" : 4, background: sign.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: sign.textColor, border: sign.border ? `2px solid ${sign.border}` : "none" }}>
                                  {sign.label.slice(0, 4)}
                                </div>
                                <span style={{ fontSize: 8, color: COLORS.textMuted, textAlign: "center" }}>{sign.label}</span>
                              </button>
                              <button onClick={() => setCustomSigns((prev) => prev.filter((s) => s.id !== sign.id))}
                                style={{ position: "absolute", top: 2, right: 2, background: "rgba(239,68,68,0.15)", border: "none", color: COLORS.danger, borderRadius: 3, width: 14, height: 14, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div style={{ marginTop: 12, padding: 8, background: "rgba(245,158,11,0.05)", borderRadius: 6, border: `1px solid rgba(245,158,11,0.1)` }}>
                      <div style={{ fontSize: 9, color: COLORS.accent }}>Select a sign then click on the canvas to place it.</div>
                    </div>
                  </>
                )}

                {signSubTab === "editor" && (
                  <SignEditorPanel
                    onSignChange={setSelectedSign}
                    onUseSign={() => requestTool("sign")}
                    onSaveToLibrary={(signData) => {
                      const existing = customSigns.find((s) =>
                        s.label === signData.label && s.shape === signData.shape &&
                        s.color === signData.color && s.textColor === signData.textColor
                      );
                      if (existing) {
                        if (confirm(`"${signData.label}" is already in your library. Overwrite it?`)) {
                          setCustomSigns((prev) => prev.map((s) => s.id === existing.id ? { ...signData, id: existing.id } : s));
                        }
                      } else {
                        setCustomSigns((prev) => [...prev, signData]);
                      }
                    }}
                  />
                )}
              </>
            )}

            {leftPanel === "devices" && (
              <>
                {sectionTitle("Traffic Devices")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                  {DEVICES.map((dev) => (
                    <button key={dev.id} onClick={() => { setSelectedDevice(dev); requestTool("device"); }}
                      style={{ padding: "10px 6px", background: selectedDevice?.id === dev.id && tool === "device" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: selectedDevice?.id === dev.id && tool === "device" ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`, borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 20 }}>{dev.icon}</span>
                      <span style={{ fontSize: 8, color: COLORS.textMuted }}>{dev.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {leftPanel === "roads" && (
              <>
                {sectionTitle("Drawing Mode")}
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[
                    { id: "straight", label: "Straight", icon: "━" },
                    { id: "poly",     label: "Polyline", icon: "⌇" },
                    { id: "smooth",   label: "Smooth",   icon: "∿" },
                    { id: "curve",    label: "Quad",     icon: "⌒" },
                    { id: "cubic",    label: "Cubic",    icon: "⌣" },
                  ].map((mode) => (
                    <button key={mode.id}
                      onClick={() => { setRoadDrawMode(mode.id); requestTool("road"); }}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 9, background: roadDrawMode === mode.id && tool === "road" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: `1px solid ${roadDrawMode === mode.id && tool === "road" ? COLORS.accent : COLORS.panelBorder}`, color: roadDrawMode === mode.id && tool === "road" ? COLORS.accent : COLORS.textMuted, borderRadius: 5, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 16 }}>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>

                {sectionTitle("Road Types")}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {ROAD_TYPES.map((rt) => (
                    <button key={rt.id} onClick={() => { setSelectedRoadType(rt); requestTool("road"); }}
                      style={{ padding: "10px 12px", background: selectedRoadType?.id === rt.id && tool === "road" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: selectedRoadType?.id === rt.id && tool === "road" ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                      <div>
                        <div style={{ fontSize: 11, color: COLORS.text, fontWeight: 500 }}>{rt.label}</div>
                        <div style={{ fontSize: 9, color: COLORS.textDim }}>{rt.lanes} lanes · {rt.width}px wide</div>
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array(rt.lanes).fill(0).map((_, i) => (
                          <div key={i} style={{ width: 4, height: 20, background: COLORS.road, borderRadius: 1, border: `1px solid ${COLORS.panelBorder}` }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {sectionTitle("Turn Lane")}
                <button
                  onClick={() => requestTool("turn_lane")}
                  style={{ width: "100%", padding: "10px 12px", background: tool === "turn_lane" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: tool === "turn_lane" ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: tool === "turn_lane" ? COLORS.accent : COLORS.textMuted, fontSize: 11 }}>
                  <span style={{ fontSize: 16 }}>↰</span>
                  <span>Place Turn Lane</span>
                </button>

                {sectionTitle("Intersection Templates")}
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {([
                    { id: 't' as const, label: 'T-Junction', icon: '⊤' },
                    { id: '4way' as const, label: '4-Way', icon: '✛' },
                  ]).map((itype) => (
                    <button key={itype.id}
                      onClick={() => { setIntersectionType(itype.id); requestTool("intersection"); }}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 9, background: intersectionType === itype.id && tool === "intersection" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: `1px solid ${intersectionType === itype.id && tool === "intersection" ? COLORS.accent : COLORS.panelBorder}`, color: intersectionType === itype.id && tool === "intersection" ? COLORS.accent : COLORS.textMuted, borderRadius: 5, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 16 }}>{itype.icon}</span>
                      <span>{itype.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 12, padding: 8, background: "rgba(245,158,11,0.05)", borderRadius: 6, border: `1px solid rgba(245,158,11,0.1)` }}>
                  <div style={{ fontSize: 9, color: COLORS.accent }}>
                    {tool === "intersection" && `Click canvas to stamp a ${intersectionType === '4way' ? '4-way' : 'T-junction'} intersection using the selected road type.`}
                    {tool !== "intersection" && roadDrawMode === "straight" && "Click and drag to draw a straight road."}
                    {tool !== "intersection" && roadDrawMode === "poly" && "Click to add points. Double-click or Enter to finish. Esc to cancel."}
                    {tool !== "intersection" && roadDrawMode === "smooth" && "Click to add points. Road curves smoothly through them. Double-click or Enter to finish."}
                    {tool !== "intersection" && roadDrawMode === "curve" && "Click: start → control point → end. Esc to cancel."}
                    {tool !== "intersection" && roadDrawMode === "cubic" && "Click: start → cp1 → cp2 → end. Drag handles to reshape. Esc to cancel."}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── CANVAS (Konva Stage) ─── */}
        <div ref={containerRef} data-testid="canvas-container" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Stage
            ref={stageRef}
            data-testid="konva-stage"
            width={canvasSize.w}
            height={canvasSize.h}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onMouseLeave={() => { setIsPanning(false); setPanStart(null); setSnapIndicator(null); }}
            style={{
              cursor: tool === "pan" || isPanning ? "grab" : tool === "erase" ? "crosshair" : tool === "select" ? "default" : "crosshair",
            }}
          >
            {/* Layer 1: Map tiles — screen-space coords, no world transform */}
            <Layer>
              <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill={COLORS.canvas} listening={false} />
              {mapCenter && mapTiles.map((tile) => {
                const cached = mapTileCacheRef.current[tile.url];
                if (!cached?.loaded) return null;
                return (
                  <KonvaImage key={tile.url} image={cached.image}
                    x={tile.x} y={tile.y} width={tile.size} height={tile.size} listening={false} />
                );
              })}
              {mapCenter && (
                <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h}
                  fill="rgba(15,17,23,0.18)" listening={false} />
              )}
            </Layer>

            {/* Layer 2: World objects — transformed to world-space */}
            <Layer x={offset.x} y={offset.y} scaleX={zoom} scaleY={zoom}>
              {showGrid && <GridLines offset={offset} zoom={zoom} canvasSize={canvasSize} />}
              {objects.map((obj) => {
                const isSel = obj.id === selected;
                const robj = ('realWidth' in obj && (obj as { realWidth?: number }).realWidth && mapCenter)
                  ? { ...obj, width: geoRoadWidthPx(obj as { width: number; realWidth?: number }, mapCenter) }
                  : obj;
                return <ObjectShape key={obj.id} obj={robj as CanvasObject} isSelected={isSel} />;
              })}
            </Layer>

            {/* Layer 3: Drawing overlays — same world-space transform as Layer 2 */}
            <Layer x={offset.x} y={offset.y} scaleX={zoom} scaleY={zoom}>
              <DrawingOverlays
                tool={tool}
                roadDrawMode={roadDrawMode}
                drawStart={drawStart}
                cursorPos={cursorPos}
                snapIndicator={snapIndicator}
                polyPoints={polyPoints}
                curvePoints={curvePoints}
                cubicPoints={cubicPoints}
              />
            </Layer>
          </Stage>

          <NorthArrow visible={showNorthArrow} />
          <LegendBox objects={objects} visible={showLegend} />

          {/* Blank canvas overlay — shown until user enters an address */}
          {!mapCenter && (
            <div data-testid="blank-canvas-overlay" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 12 }}>
              <div style={{ fontSize: 48, opacity: 0.25 }}>📍</div>
              <div style={{ fontSize: 15, color: COLORS.textMuted, opacity: 0.6, textAlign: "center", lineHeight: 1.5 }}>
                Enter a job site address in the toolbar above<br />to load the map
              </div>
            </div>
          )}

          {/* Address-required modal — shown when user clicks a drawing tool without an address */}
          {showAddressRequired && (
            <div data-testid="address-required-modal" role="dialog" aria-modal="true" aria-labelledby="addr-modal-title" onClick={() => setShowAddressRequired(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: "28px 32px", maxWidth: 340, width: "90%", textAlign: "center", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
                <div id="addr-modal-title" style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Address Required</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                  Enter a job site address to load the map before drawing.
                </div>
                <button
                  ref={addrModalGoRef}
                  data-testid="address-required-go-button"
                  onClick={() => { setShowAddressRequired(false); searchInputRef.current?.focus(); searchInputRef.current?.select(); }}
                  style={{ background: COLORS.accent, color: "#111", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Enter address →
                </button>
                <button
                  onClick={() => setShowAddressRequired(false)}
                  style={{ display: "block", margin: "10px auto 0", background: "transparent", border: "none", color: COLORS.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Status bar */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: COLORS.panel, borderTop: `1px solid ${COLORS.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", fontSize: 10, color: COLORS.textDim }}>
            <div style={{ display: "flex", gap: 16 }}>
              <span>X: {cursorPos.x.toFixed(0)}</span>
              <span>Y: {cursorPos.y.toFixed(0)}</span>
              <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {polyInProgress && (
                <span style={{ color: COLORS.accent }}>
                  {polyPoints.length} pts · Enter/DblClick to finish · Esc cancel
                </span>
              )}
              {curveInProgress && (
                <span style={{ color: COLORS.info }}>
                  Quad: {curvePoints.length === 1 ? "click control point" : "click end point"} · Esc cancel
                </span>
              )}
              {cubicInProgress && (
                <span style={{ color: COLORS.info }}>
                  Cubic: {cubicPoints.length === 1 ? "click cp1" : cubicPoints.length === 2 ? "click cp2" : "click end"} · Esc cancel
                </span>
              )}
              {tool === "select" && !selected && (
                <span style={{ color: COLORS.textMuted }}>Click an object to select · Drag to move · Del to delete</span>
              )}
              {tool === "pan" && (
                <span style={{ color: COLORS.textMuted }}>Click and drag to pan the canvas · Scroll to zoom</span>
              )}
              {tool === "road" && !drawStart && !polyInProgress && !curveInProgress && !cubicInProgress && (
                <span style={{ color: COLORS.textMuted }}>
                  {roadDrawMode === "straight" && "Click and drag to draw a road"}
                  {roadDrawMode === "poly" && "Click to start a polyline road · Enter/DblClick to finish"}
                  {roadDrawMode === "smooth" && "Click to add smooth road points · Enter/DblClick to finish"}
                  {roadDrawMode === "curve" && "Click start, then control point, then end"}
                  {roadDrawMode === "cubic" && "Click start, cp1, cp2, end"}
                </span>
              )}
              {tool === "intersection" && (
                <span style={{ color: COLORS.textMuted }}>Click to stamp an intersection</span>
              )}
              {tool === "sign" && (
                <span style={{ color: COLORS.textMuted }}>Click to place the selected sign</span>
              )}
              {tool === "device" && (
                <span style={{ color: COLORS.textMuted }}>Click to place the selected device</span>
              )}
              {tool === "zone" && !drawStart && (
                <span style={{ color: COLORS.textMuted }}>Click and drag to draw a work zone boundary</span>
              )}
              {tool === "text" && (
                <span style={{ color: COLORS.textMuted }}>Click to place a text label</span>
              )}
              {tool === "measure" && !drawStart && (
                <span style={{ color: COLORS.textMuted }}>Click and drag to measure a distance</span>
              )}
              {tool === "arrow" && !drawStart && (
                <span style={{ color: COLORS.textMuted }}>Click and drag to draw a directional arrow</span>
              )}
              {tool === "taper" && (
                <span style={{ color: COLORS.textMuted }}>Click to place a lane closure taper</span>
              )}
              {tool === "lane_mask" && !drawStart && (
                <span style={{ color: COLORS.danger }}>Click and drag to draw a lane closure mask</span>
              )}
              {tool === "crosswalk" && !drawStart && (
                <span style={{ color: COLORS.info }}>Click and drag across a road to place a crosswalk</span>
              )}
              {tool === "turn_lane" && (
                <span style={{ color: COLORS.info }}>Click to place a turn lane</span>
              )}
              {tool === "erase" && (
                <span style={{ color: COLORS.danger }}>Click any object to delete it</span>
              )}
              <span data-testid="object-count">{objects.length} objects</span>
              <span>Tool: {tool.toUpperCase()}{tool === "road" ? ` (${roadDrawMode})` : tool === "intersection" ? ` (${intersectionType})` : ""}</span>
              <span>{showGrid ? "Grid ON" : "Grid OFF"}</span>
              <span>{snapEnabled ? "Snap: segment" : "Snap OFF"}</span>
              {autosaveError
                ? <span style={{ color: COLORS.danger }} title={`Auto-save failed: ${autosaveError}`}>⚠ Save failed</span>
                : <span style={{ color: COLORS.success }} title="Auto-saved to browser storage">● Auto-saved</span>
              }
              <span data-testid="app-version" style={{ color: COLORS.textDim, opacity: 0.6 }} title="App version">v{__APP_VERSION__}</span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        {rightPanel && (
          <div data-testid="right-panel" style={{ width: 220, background: COLORS.panel, borderLeft: `1px solid ${COLORS.panelBorder}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div role="tablist" aria-label="Right panel tabs" style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, display: "flex", alignItems: "center" }}>
              <button type="button" role="tab" aria-selected={rightTab === "properties"} tabIndex={rightTab === "properties" ? 0 : -1}
                ref={propertiesTabRef} data-testid="tab-properties"
                onClick={() => setRightTab("properties")} onKeyDown={(e) => handleRightTabKeyDown(e, "properties")}
                style={{ flex: 1, padding: "8px 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, background: "none", border: "none", borderBottom: rightTab === "properties" ? `2px solid ${COLORS.accent}` : "2px solid transparent", color: rightTab === "properties" ? COLORS.accent : COLORS.textDim, cursor: "pointer" }}>
                Properties
              </button>
              <button type="button" role="tab" aria-selected={rightTab === "manifest"} tabIndex={rightTab === "manifest" ? 0 : -1}
                ref={manifestTabRef} data-testid="tab-manifest"
                onClick={() => setRightTab("manifest")} onKeyDown={(e) => handleRightTabKeyDown(e, "manifest")}
                style={{ flex: 1, padding: "8px 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, background: "none", border: "none", borderBottom: rightTab === "manifest" ? `2px solid ${COLORS.accent}` : "2px solid transparent", color: rightTab === "manifest" ? COLORS.accent : COLORS.textDim, cursor: "pointer" }}>
                Manifest
              </button>
              <button type="button" role="tab" aria-selected={rightTab === "qc"} tabIndex={rightTab === "qc" ? 0 : -1}
                ref={qcTabRef} data-testid="tab-qc"
                onClick={() => setRightTab("qc")} onKeyDown={(e) => handleRightTabKeyDown(e, "qc")}
                style={{ flex: 1, padding: "8px 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, background: "none", border: "none", borderBottom: rightTab === "qc" ? `2px solid ${COLORS.accent}` : "2px solid transparent", color: rightTab === "qc" ? COLORS.accent : COLORS.textDim, cursor: "pointer", position: "relative" }}>
                QC{getQCBadgeColor(qcIssues) && <span style={{ position: "absolute", top: 6, right: 2, width: 6, height: 6, borderRadius: "50%", background: getQCBadgeColor(qcIssues)! }} />}
              </button>
              <button type="button" onClick={() => setRightPanel(false)} data-testid="close-right-panel" style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 14, padding: "0 10px" }}>×</button>
            </div>
            {rightTab === "properties"
              ? <PropertyPanel selected={selected} objects={objects} onUpdate={updateObject} onDelete={deleteObject} onReorder={reorderObject} planMeta={planMeta} onUpdateMeta={setPlanMeta} />
              : rightTab === "manifest"
              ? <ManifestPanel objects={objects} />
              : <QCPanel issues={qcIssues} />
            }

            <div style={{ marginTop: "auto", borderTop: `1px solid ${COLORS.panelBorder}`, padding: 12 }}>
              {sectionTitle("Layers")}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflow: "auto" }}>
                {objects.length === 0 && (
                  <div style={{ fontSize: 10, color: COLORS.textDim, textAlign: "center", padding: 12 }}>No objects yet</div>
                )}
                {[...objects].reverse().map((obj) => (
                  <div key={obj.id} onClick={() => setSelected(obj.id)}
                    style={{ padding: "5px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: selected === obj.id ? COLORS.accentDim : "transparent", color: selected === obj.id ? COLORS.accent : COLORS.textMuted, border: selected === obj.id ? `1px solid rgba(245,158,11,0.2)` : "1px solid transparent" }}>
                    <span style={{ fontSize: 12 }}>
                      {obj.type === "road" ? "━" : obj.type === "polyline_road" ? "⌇" : obj.type === "curve_road" ? "⌒" : obj.type === "cubic_bezier_road" ? "⌣" : obj.type === "sign" ? "⬡" : obj.type === "device" ? "▲" : obj.type === "zone" ? "▨" : obj.type === "arrow" ? "→" : obj.type === "text" ? "T" : obj.type === "taper" ? "⋈" : obj.type === "lane_mask" ? "▧" : obj.type === "crosswalk" ? "⊟" : obj.type === "turn_lane" ? "↰" : "📏"}
                    </span>
                    <span>
                      {obj.type === "sign" ? obj.signData.label :
                       obj.type === "device" ? obj.deviceData.label :
                       obj.type === "text" ? `"${obj.text.slice(0, 12)}"` :
                       obj.type === "road" ? `${obj.roadType} road` :
                       obj.type === "polyline_road" ? `poly (${obj.points.length}pts)` :
                       obj.type === "curve_road" ? "quad road" :
                       obj.type === "cubic_bezier_road" ? "cubic road" :
                       obj.type === "taper" ? `taper ${obj.speed}mph` :
                       obj.type === "lane_mask" ? "lane mask" :
                       obj.type === "crosswalk" ? "crosswalk" :
                       obj.type === "turn_lane" ? `turn lane (${obj.turnDir})` :
                       obj.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {!rightPanel && (
          <button onClick={() => setRightPanel(true)} data-testid="toggle-right-panel"
            style={{ position: "absolute", top: 60, right: 12, ...panelBtnStyle(false), background: COLORS.panel }}>
            ◀ Props
          </button>
        )}
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showDashboard && userId && CLOUD_ENABLED && (
        <PlanDashboard
          userId={userId}
          onOpen={handleDashboardOpen}
          onClose={() => setShowDashboard(false)}
        />
      )}
      {showTemplatePicker && (
        <TemplatePicker
          onApply={handleTemplateApply}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
      {exportPreview && (
        <ExportPreviewModal
          canvasDataUrl={`data:image/png;base64,${exportPreview.canvas_image_b64 as string}`}
          planTitle={planTitle}
          planMeta={planMeta}
          planCreatedAt={planCreatedAt}
          qcIssues={qcIssues}
          onConfirm={confirmExportPDF}
          onClose={() => setExportPreview(null)}
        />
      )}
    </div>
  );
}
