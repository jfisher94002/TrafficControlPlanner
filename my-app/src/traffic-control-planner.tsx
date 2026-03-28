import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Group, Shape, Image as KonvaImage } from "react-konva";
import type Konva from 'konva';
import type { Context as KonvaContext } from 'konva/lib/Context';
import type { KonvaEventObject } from 'konva/lib/Node';
import type React from 'react';
import type {
  CanvasObject, StraightRoadObject, PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject,
  SignObject, DeviceObject, ZoneObject, ArrowObject, TextObject, MeasureObject, TaperObject,
  SignData, DeviceData, RoadType, DrawStart, PanStart,
  MapCenter, MapTile, MapTileEntry, PlanMeta, Point, SnapResult, ToolDef,
  GeocodeResult, SignShape,
} from './types';
import { uid, dist, angleBetween, geoRoadWidthPx, snapToEndpoint, sampleBezier, sampleCubicBezier, distToPolyline, formatSearchPrimary, geocodeAddress, isPointObject, isLineObject, isRoad, isMultiPointRoad, calcTaperLength, cloneObject } from './utils';
import { savePlanToCloud } from './planStorage';
import PlanDashboard from './PlanDashboard';
import TemplatePicker from './TemplatePicker';
import ExportPreviewModal from './ExportPreviewModal';
import { runQCChecks, type QCIssue } from './qcRules';
import { track } from './analytics';

// ─── CONSTANTS & DATA ────────────────────────────────────────────────────────
const GRID_SIZE = 20;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const SNAP_RADIUS = 14;    // screen-pixels for endpoint snap
const STATUS_BAR_H = 28;   // height of the bottom status bar in px

const COLORS = {
  bg: "#0f1117",
  panel: "#1a1d27",
  panelBorder: "#2a2d3a",
  accent: "#f59e0b",
  accentHover: "#fbbf24",
  accentDim: "rgba(245,158,11,0.15)",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  canvas: "#1e2028",
  grid: "rgba(255,255,255,0.03)",
  road: "#3a3d4a",
  roadLine: "#f59e0b",
  roadLineWhite: "#ffffff",
  laneMarking: "rgba(255,255,255,0.6)",
  danger: "#ef4444",
  success: "#22c55e",
  info: "#3b82f6",
  selected: "#818cf8",
};

const SIGN_SHAPES: Array<{ id: SignShape; label: string; preview: string }> = [
  { id: "diamond",  label: "Diamond",   preview: "◆" },
  { id: "rect",     label: "Rectangle", preview: "▬" },
  { id: "octagon",  label: "Octagon",   preview: "⬡" },
  { id: "circle",   label: "Circle",    preview: "●" },
  { id: "triangle", label: "Triangle",  preview: "▲" },
  { id: "shield",   label: "Shield",    preview: "⊲" },
];

const SIGN_CATEGORIES: Record<string, { label: string; color: string; signs: SignData[] }> = {
  regulatory: {
    label: "Regulatory",
    color: "#ef4444",
    signs: [
      { id: "stop",          label: "STOP",         shape: "octagon",  color: "#ef4444", textColor: "#fff", mutcd: "R1-1" },
      { id: "yield",         label: "YIELD",        shape: "triangle", color: "#ef4444", textColor: "#fff", mutcd: "R1-2" },
      { id: "speed15",       label: "15 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed20",       label: "20 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed25",       label: "25 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed30",       label: "30 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed35",       label: "35 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed40",       label: "40 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed45",       label: "45 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed50",       label: "50 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed55",       label: "55 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "speed65",       label: "65 MPH",       shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R2-1" },
      { id: "noentry",       label: "NO ENTRY",     shape: "circle",   color: "#ef4444", textColor: "#fff", mutcd: "R5-1" },
      { id: "oneway",        label: "ONE WAY",      shape: "rect",     color: "#111",    textColor: "#fff", mutcd: "R6-1" },
      { id: "donotenter",    label: "DO NOT ENTER", shape: "rect",     color: "#ef4444", textColor: "#fff", mutcd: "R5-1" },
      { id: "noleftturn",    label: "NO LEFT TRN",  shape: "circle",   color: "#ef4444", textColor: "#fff", mutcd: "R3-2" },
      { id: "norightturn",   label: "NO RIGHT TRN", shape: "circle",   color: "#ef4444", textColor: "#fff", mutcd: "R3-1" },
      { id: "noparking",     label: "NO PARKING",   shape: "circle",   color: "#ef4444", textColor: "#fff", mutcd: "R7-1" },
      { id: "nopassing",     label: "NO PASSING",   shape: "rect",     color: "#fff",    textColor: "#111", border: "#111", mutcd: "R4-1" },
      { id: "wrongway",      label: "WRONG WAY",    shape: "rect",     color: "#ef4444", textColor: "#fff", mutcd: "R5-1a" },
    ],
  },
  warning: {
    label: "Warning",
    color: "#f59e0b",
    signs: [
      { id: "roadwork",       label: "ROAD WORK",    shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W20-1" },
      { id: "flagahead",      label: "FLAGGER",      shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W20-7a" },
      { id: "merge",          label: "MERGE",        shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W4-2" },
      { id: "curve",          label: "CURVE",        shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W1-2" },
      { id: "narrow",         label: "NARROW",       shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W5-1" },
      { id: "bump",           label: "BUMP",         shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W8-1" },
      { id: "pedestrian",     label: "PED XING",     shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W11-2" },
      { id: "signal",         label: "SIGNAL AHEAD", shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W3-3" },
      { id: "schoolzone",     label: "SCHOOL ZONE",  shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W5-2" },
      { id: "schoolxing",     label: "SCHOOL XING",  shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "S1-1" },
      { id: "bikexing",       label: "BIKE XING",    shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W11-15" },
      { id: "deerxing",       label: "DEER XING",    shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W11-3" },
      { id: "slippery",       label: "SLIPPERY",     shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W8-5" },
      { id: "loosegravel",    label: "LOOSE GRAVEL", shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W8-7" },
      { id: "dividedroad",    label: "DIVIDED RD",   shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W6-1" },
      { id: "endsdivided",    label: "ENDS DIVIDED", shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W6-2" },
      { id: "lowclearance",   label: "LOW CLEAR",    shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W12-2" },
      { id: "rightcurve",     label: "RIGHT CURVE",  shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W1-2R" },
      { id: "leftcurve",      label: "LEFT CURVE",   shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W1-2L" },
      { id: "winding",        label: "WINDING RD",   shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W1-5" },
      { id: "hillgrade",      label: "HILL/GRADE",   shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W7-1" },
      { id: "workers",        label: "WORKERS",      shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W21-1a" },
      { id: "trafficcontrols",label: "TRAF CTRL",    shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W20-7" },
    ],
  },
  temporary: {
    label: "Temp Traffic Control",
    color: "#f97316",
    signs: [
      { id: "roadclosed",   label: "ROAD CLOSED",   shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "R11-2" },
      { id: "detour",       label: "DETOUR",        shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "M4-8" },
      { id: "laneclosed",   label: "LANE CLOSED",   shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "R11-2a" },
      { id: "endwork",      label: "END ROAD WORK", shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "G20-2" },
      { id: "slowtraffic",  label: "SLOW TRAFFIC",  shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W20-4" },
      { id: "workzone",     label: "WORK ZONE",     shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W20-1" },
      { id: "workahead",    label: "WORK AHEAD",    shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W20-1" },
      { id: "preparestop",  label: "PREP TO STOP",  shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W20-4" },
      { id: "onelane",      label: "ONE LANE RD",   shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W20-4a" },
      { id: "surveyors",    label: "SURVEYORS",     shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W21-5" },
      { id: "rightlane",    label: "RIGHT LANE",    shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W9-1" },
      { id: "leftlane",     label: "LEFT LANE",     shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W9-2" },
      { id: "centerlane",   label: "CENTER LANE",   shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W9-3" },
      { id: "flaggerahead", label: "FLAGGER AHD",   shape: "diamond", color: "#f97316", textColor: "#111", mutcd: "W20-7a" },
      { id: "reducespeed",  label: "REDUCE SPEED",  shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "W20-4" },
      { id: "endworkahead", label: "END WORK AHD",  shape: "rect",    color: "#f97316", textColor: "#111", mutcd: "G20-2" },
    ],
  },
  guide: {
    label: "Guide & Info",
    color: "#22c55e",
    signs: [
      { id: "parking",       label: "P",           shape: "rect",   color: "#3b82f6", textColor: "#fff", mutcd: "D4-1" },
      { id: "hospital",      label: "H",           shape: "rect",   color: "#3b82f6", textColor: "#fff", mutcd: "H-1" },
      { id: "info",          label: "INFO",        shape: "rect",   color: "#3b82f6", textColor: "#fff", mutcd: "I-2" },
      { id: "interstate",    label: "I-95",        shape: "shield", color: "#3b82f6", textColor: "#fff", mutcd: "M1-1" },
      { id: "exitramp",      label: "EXIT",        shape: "rect",   color: "#22c55e", textColor: "#fff", mutcd: "E5-1" },
      { id: "speedadvisory", label: "ADVISORY",    shape: "rect",   color: "#f59e0b", textColor: "#111", mutcd: "R2-3" },
      { id: "distanceahead", label: "1 MILE",      shape: "rect",   color: "#22c55e", textColor: "#fff", mutcd: "W16-2" },
      { id: "noparkingnorth",label: "NO PARKING",  shape: "rect",   color: "#fff",    textColor: "#111", border: "#111", mutcd: "R7-1" },
      { id: "restarea",      label: "REST AREA",   shape: "rect",   color: "#3b82f6", textColor: "#fff", mutcd: "D5-1" },
      { id: "foodgas",       label: "FOOD/GAS",    shape: "rect",   color: "#3b82f6", textColor: "#fff", mutcd: "I-2" },
    ],
  },
  school: {
    label: "School Zone",
    color: "#f59e0b",
    signs: [
      { id: "school",       label: "SCHOOL",      shape: "rect",    color: "#f59e0b", textColor: "#111", mutcd: "S4-3" },
      { id: "schoolspeed",  label: "15 SCHOOL",   shape: "rect",    color: "#f59e0b", textColor: "#111", mutcd: "S5-1" },
      { id: "slowschool",   label: "SLOW SCHOOL", shape: "rect",    color: "#f59e0b", textColor: "#111", mutcd: "S4-3a" },
      { id: "schoolbus",    label: "SCHOOL BUS",  shape: "rect",    color: "#f59e0b", textColor: "#111", mutcd: "S3-1" },
      { id: "schoolbusxing",label: "BUS XING",    shape: "diamond", color: "#f59e0b", textColor: "#111", mutcd: "S3-1" },
      { id: "crosswalk",    label: "CROSSWALK",   shape: "rect",    color: "#f59e0b", textColor: "#111", mutcd: "R7-9" },
      { id: "pedxing",      label: "PED XING",    shape: "diamond", color: "#f59e0b", textColor: "#111", mutcd: "W11-2" },
    ],
  },
  bicycle: {
    label: "Bicycle & Pedestrian",
    color: "#22c55e",
    signs: [
      { id: "bikeroute",   label: "BIKE ROUTE",  shape: "rect",    color: "#22c55e", textColor: "#fff", mutcd: "D11-1" },
      { id: "bikexingped", label: "BIKE XING",   shape: "diamond", color: "#22c55e", textColor: "#111", mutcd: "W11-15" },
      { id: "pedxingbike", label: "PED XING",    shape: "diamond", color: "#22c55e", textColor: "#111", mutcd: "W11-2" },
      { id: "sharedpath",  label: "SHARED PATH", shape: "rect",    color: "#22c55e", textColor: "#fff", mutcd: "R9-7" },
      { id: "hikerbiker",  label: "HIKE/BIKE",   shape: "rect",    color: "#22c55e", textColor: "#fff", mutcd: "D11-1" },
      { id: "bikepath",    label: "BIKE PATH",   shape: "rect",    color: "#22c55e", textColor: "#fff", mutcd: "D11-1" },
    ],
  },
};

const DEVICES: DeviceData[] = [
  { id: "cone",        label: "Traffic Cone",  icon: "▲",  color: "#f97316" },
  { id: "barrel",      label: "Drum/Barrel",   icon: "◉",  color: "#f97316" },
  { id: "barrier",     label: "Barrier",       icon: "▬",  color: "#fbbf24" },
  { id: "delineator",  label: "Delineator",    icon: "│",  color: "#f97316" },
  { id: "arrow_board", label: "Arrow Board",   icon: "⟹", color: "#fbbf24" },
  { id: "message_sign",label: "Message Sign",  icon: "▣",  color: "#fbbf24" },
  { id: "flagman",     label: "Flagger",       icon: "🏴", color: "#22c55e" },
  { id: "temp_signal", label: "Temp Signal",   icon: "🚦", color: "#ef4444" },
  { id: "crashcush",   label: "Crash Cushion", icon: "⟐",  color: "#ef4444" },
  { id: "water_barrel",label: "Water Barrel",  icon: "⊚",  color: "#3b82f6" },
];

/** Strips hyphens, spaces, and dots then lowercases — used for fuzzy MUTCD matching. */
function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[\s\-./]/g, '')
}

function createIntersectionRoads(
  cx: number, cy: number,
  type: 't' | '4way',
  roadType: RoadType,
): StraightRoadObject[] {
  const L = roadType.width * 3
  const base = { width: roadType.width, realWidth: roadType.realWidth, lanes: roadType.lanes, roadType: roadType.id }
  if (type === '4way') return [
    { id: uid(), type: 'road', x1: cx - L, y1: cy, x2: cx + L, y2: cy, ...base },
    { id: uid(), type: 'road', x1: cx, y1: cy - L, x2: cx, y2: cy + L, ...base },
  ]
  return [
    { id: uid(), type: 'road', x1: cx - L, y1: cy, x2: cx + L, y2: cy, ...base },
    { id: uid(), type: 'road', x1: cx, y1: cy, x2: cx, y2: cy - L, ...base },
  ]
}

// realWidth = diagram-scale meters (≈3× real-world so roads are wide enough to work with on screen)
const ROAD_TYPES: RoadType[] = [
  { id: "2lane",   label: "2-Lane Road",     lanes: 2, width: 80,  realWidth: 22 },
  { id: "4lane",   label: "4-Lane Road",     lanes: 4, width: 150, realWidth: 44 },
  { id: "6lane",   label: "6-Lane Divided",  lanes: 6, width: 220, realWidth: 66 },
  { id: "highway", label: "Highway",         lanes: 4, width: 180, realWidth: 58 },
];


const TOOLS: ToolDef[] = [
  { id: "select",  label: "Select",    icon: "↖", shortcut: "V" },
  { id: "pan",     label: "Pan",       icon: "✋", shortcut: "H" },
  { id: "road",    label: "Road",      icon: "━", shortcut: "R" },
  { id: "sign",    label: "Sign",      icon: "⬡", shortcut: "S" },
  { id: "device",  label: "Device",    icon: "▲", shortcut: "D" },
  { id: "zone",    label: "Work Zone", icon: "▨", shortcut: "Z" },
  { id: "text",    label: "Text",      icon: "T", shortcut: "T" },
  { id: "measure", label: "Measure",   icon: "📏", shortcut: "M" },
  { id: "arrow",   label: "Arrow",     icon: "→", shortcut: "A" },
  { id: "taper",   label: "Taper",     icon: "⋈", shortcut: "P" },
  { id: "erase",   label: "Erase",     icon: "✕", shortcut: "X" },
];

// ─── AUTOSAVE ────────────────────────────────────────────────────────────────
const AUTOSAVE_KEY = "tcp_autosave";
function readAutosave() {
  try { return JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || "null"); }
  catch { return null; }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sectionTitle = (text: string) => (
  <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginTop: 12, fontFamily: "'JetBrains Mono', monospace" }}>
    {text}
  </div>
);

const panelBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  background: active ? COLORS.accentDim : "transparent",
  color: active ? COLORS.accent : COLORS.textMuted,
  border: active ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`,
  borderRadius: 5,
  cursor: "pointer",
  transition: "all 0.15s",
});


// ─── DRAW SIGN (kept for SignEditorPanel preview canvas) ───────────────────────
function drawSign(ctx: CanvasRenderingContext2D, sign: { x: number; y: number; signData: SignData; rotation: number; scale: number }, isSelected: boolean): void {
  const { x, y, signData, rotation = 0, scale = 1 } = sign;
  const s = 28 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  if (isSelected) { ctx.shadowColor = COLORS.selected; ctx.shadowBlur = 12; }

  const shape = signData.shape;
  if (shape === "octagon") {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.7); ctx.lineTo(-s, s * 0.7);
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else if (shape === "shield") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s); ctx.lineTo(s * 0.7, -s);
    ctx.lineTo(s * 0.8, -s * 0.3); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, -s * 0.3);
    ctx.closePath();
    ctx.fillStyle = signData.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.fillStyle = signData.color || "#fff";
    ctx.strokeStyle = signData.border || "#333";
    ctx.lineWidth = 2;
    ctx.fillRect(-s, -s * 0.65, s * 2, s * 1.3);
    ctx.strokeRect(-s, -s * 0.65, s * 2, s * 1.3);
  }

  ctx.fillStyle = signData.textColor || "#fff";
  const label = signData.label.length > 12 ? signData.label.slice(0, 11) + "…" : signData.label;
  const baseFontSize = label.length <= 4 ? 13 : label.length <= 8 ? 11 : 8;
  ctx.font = `bold ${Math.max(6, baseFontSize * scale)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, shape === "triangle" ? 4 : 0);
  ctx.restore();
}

// ─── KONVA OBJECT COMPONENTS ──────────────────────────────────────────────────

interface GridLinesProps { offset: Point; zoom: number; canvasSize: { w: number; h: number }; }
function GridLines({ offset, zoom, canvasSize }: GridLinesProps) {
  const startX = Math.floor(-offset.x / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
  const startY = Math.floor(-offset.y / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
  const endX = startX + canvasSize.w / zoom + GRID_SIZE * 2;
  const endY = startY + canvasSize.h / zoom + GRID_SIZE * 2;
  const lines = [];
  for (let gx = startX; gx < endX; gx += GRID_SIZE) {
    lines.push(<Line key={`x${gx}`} points={[gx, startY, gx, endY]} stroke={COLORS.grid} strokeWidth={0.5} listening={false} />);
  }
  for (let gy = startY; gy < endY; gy += GRID_SIZE) {
    lines.push(<Line key={`y${gy}`} points={[startX, gy, endX, gy]} stroke={COLORS.grid} strokeWidth={0.5} listening={false} />);
  }
  return <>{lines}</>;
}

interface RoadSegmentProps { obj: StraightRoadObject; isSelected: boolean; }
function RoadSegment({ obj, isSelected }: RoadSegmentProps) {
  const { x1, y1, x2, y2, width, lanes, roadType } = obj;
  const angle = angleBetween(x1, y1, x2, y2);
  const perpAngle = angle + Math.PI / 2;
  const hw = width / 2;
  const cos = Math.cos(perpAngle), sin = Math.sin(perpAngle);

  const roadPoly = [
    x1 + cos * hw, y1 + sin * hw,
    x2 + cos * hw, y2 + sin * hw,
    x2 - cos * hw, y2 - sin * hw,
    x1 - cos * hw, y1 - sin * hw,
  ];

  const laneMarkings = [];
  const laneWidth = width / lanes;
  for (let i = 1; i < lanes; i++) {
    const off = -hw + i * laneWidth;
    const lx1 = x1 + cos * off, ly1 = y1 + sin * off;
    const lx2 = x2 + cos * off, ly2 = y2 + sin * off;
    const isCenter = i === lanes / 2 && roadType !== "2lane";
    if (isCenter) {
      for (const d of [-2, 2]) {
        laneMarkings.push(
          <Line key={`c${i}_${d}`}
            points={[lx1 + cos * d, ly1 + sin * d, lx2 + cos * d, ly2 + sin * d]}
            stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
        );
      }
    } else {
      laneMarkings.push(
        <Line key={`l${i}`}
          points={[lx1, ly1, lx2, ly2]}
          stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
      );
    }
  }

  return (
    <Group listening={false}>
      {/* End-cap discs fill visual gaps at intersections where roads of different widths meet */}
      <Circle x={x1} y={y1} radius={hw + 1} fill="#555" listening={false} />
      <Circle x={x2} y={y2} radius={hw + 1} fill="#555" listening={false} />
      <Circle x={x1} y={y1} radius={hw - 1} fill={COLORS.road} listening={false} />
      <Circle x={x2} y={y2} radius={hw - 1} fill={COLORS.road} listening={false} />
      <Line points={roadPoly} closed fill={COLORS.road} stroke="#555" strokeWidth={2} />
      <Line points={[x1 + cos * hw, y1 + sin * hw, x2 + cos * hw, y2 + sin * hw]} stroke={COLORS.roadLineWhite} strokeWidth={2} />
      <Line points={[x1 - cos * hw, y1 - sin * hw, x2 - cos * hw, y2 - sin * hw]} stroke={COLORS.roadLineWhite} strokeWidth={2} />
      {laneMarkings}
      {isSelected && <Line points={[x1, y1, x2, y2]} stroke={COLORS.selected} strokeWidth={2} dash={[6, 4]} />}
    </Group>
  );
}

interface PolylineRoadProps { obj: PolylineRoadObject; isSelected: boolean; }
function PolylineRoad({ obj, isSelected }: PolylineRoadProps) {
  const { points, width, lanes, roadType, smooth } = obj;
  const tension = smooth ? 0.5 : 0;
  if (!points || points.length < 2) return null;

  const pts: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || dist(points[i].x, points[i].y, points[i - 1].x, points[i - 1].y) > 0.5)
      pts.push(points[i]);
  }
  if (pts.length < 2) return null;

  const flat = pts.flatMap((p) => [p.x, p.y]);
  const hw = width / 2;
  const laneMarkings = [];
  const laneW = width / lanes;
  for (let li = 1; li < lanes; li++) {
    const off = -hw + li * laneW;
    const isCenter = li === lanes / 2 && roadType !== "2lane";
    for (let si = 0; si < pts.length - 1; si++) {
      const { x: x1, y: y1 } = pts[si];
      const { x: x2, y: y2 } = pts[si + 1];
      const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const cx = Math.cos(perp), cy = Math.sin(perp);
      if (isCenter) {
        for (const d of [-2, 2]) {
          laneMarkings.push(
            <Line key={`c${li}_${si}_${d}`}
              points={[x1 + cx * (off + d), y1 + cy * (off + d), x2 + cx * (off + d), y2 + cy * (off + d)]}
              stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
          );
        }
      } else {
        laneMarkings.push(
          <Line key={`l${li}_${si}`}
            points={[x1 + cx * off, y1 + cy * off, x2 + cx * off, y2 + cy * off]}
            stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
        );
      }
    }
  }

  return (
    <Group listening={false}>
      <Line points={flat} stroke="#444" strokeWidth={width + 4} lineCap="round" lineJoin="round" tension={tension} />
      <Line points={flat} stroke={COLORS.roadLineWhite} strokeWidth={width} lineCap="round" lineJoin="round" tension={tension} />
      <Line points={flat} stroke={COLORS.road} strokeWidth={width - 4} lineCap="round" lineJoin="round" tension={tension} />
      {laneMarkings}
      {isSelected && (
        <>
          <Line points={flat} stroke={COLORS.selected} strokeWidth={2} dash={[6, 4]} />
          {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={4} fill={COLORS.selected} />)}
        </>
      )}
    </Group>
  );
}

interface CurveRoadProps { obj: CurveRoadObject; isSelected: boolean; }
function CurveRoad({ obj, isSelected }: CurveRoadProps) {
  const { points, width, lanes, roadType } = obj;
  if (!points || points.length < 3) return null;
  const [p0, p1, p2] = points;

  const spine = sampleBezier(p0, p1, p2, 32);
  const flat = spine.flatMap((p) => [p.x, p.y]);
  const hw = width / 2;
  const laneMarkings = [];
  const laneW = width / lanes;
  for (let li = 1; li < lanes; li++) {
    const off = -hw + li * laneW;
    const isCenter = li === lanes / 2 && roadType !== "2lane";
    for (let si = 0; si < spine.length - 1; si++) {
      const { x: x1, y: y1 } = spine[si];
      const { x: x2, y: y2 } = spine[si + 1];
      const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const cx = Math.cos(perp), cy = Math.sin(perp);
      if (isCenter) {
        for (const d of [-2, 2]) {
          laneMarkings.push(
            <Line key={`c${li}_${si}_${d}`}
              points={[x1 + cx * (off + d), y1 + cy * (off + d), x2 + cx * (off + d), y2 + cy * (off + d)]}
              stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
          );
        }
      } else {
        laneMarkings.push(
          <Line key={`l${li}_${si}`}
            points={[x1 + cx * off, y1 + cy * off, x2 + cx * off, y2 + cy * off]}
            stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
        );
      }
    }
  }

  return (
    <Group listening={false}>
      <Line points={flat} stroke="#444" strokeWidth={width + 4} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={COLORS.roadLineWhite} strokeWidth={width} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={COLORS.road} strokeWidth={width - 4} lineCap="round" lineJoin="round" tension={0} />
      {laneMarkings}
      {isSelected && (
        <>
          <Line points={flat} stroke={COLORS.selected} strokeWidth={2} dash={[6, 4]} />
          <Circle x={p1.x} y={p1.y} radius={6} fill={COLORS.info} />
          <Line points={[p0.x, p0.y, p1.x, p1.y, p2.x, p2.y]} stroke="rgba(59,130,246,0.5)" strokeWidth={1} dash={[3, 3]} />
        </>
      )}
    </Group>
  );
}

interface CubicBezierRoadProps { obj: CubicBezierRoadObject; isSelected: boolean; }
function CubicBezierRoad({ obj, isSelected }: CubicBezierRoadProps) {
  const { points, width, lanes, roadType } = obj;
  if (!points || points.length < 4) return null;
  const [p0, p1, p2, p3] = points;

  const spine = sampleCubicBezier(p0, p1, p2, p3, 32);
  const flat = spine.flatMap((p) => [p.x, p.y]);
  const hw = width / 2;
  const laneMarkings = [];
  const laneW = width / lanes;
  for (let li = 1; li < lanes; li++) {
    const off = -hw + li * laneW;
    const isCenter = li === lanes / 2 && roadType !== "2lane";
    for (let si = 0; si < spine.length - 1; si++) {
      const { x: x1, y: y1 } = spine[si];
      const { x: x2, y: y2 } = spine[si + 1];
      const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const cx = Math.cos(perp), cy = Math.sin(perp);
      if (isCenter) {
        for (const d of [-2, 2]) {
          laneMarkings.push(
            <Line key={`c${li}_${si}_${d}`}
              points={[x1 + cx * (off + d), y1 + cy * (off + d), x2 + cx * (off + d), y2 + cy * (off + d)]}
              stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
          );
        }
      } else {
        laneMarkings.push(
          <Line key={`l${li}_${si}`}
            points={[x1 + cx * off, y1 + cy * off, x2 + cx * off, y2 + cy * off]}
            stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
        );
      }
    }
  }

  return (
    <Group listening={false}>
      <Line points={flat} stroke="#444" strokeWidth={width + 4} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={COLORS.roadLineWhite} strokeWidth={width} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={COLORS.road} strokeWidth={width - 4} lineCap="round" lineJoin="round" tension={0} />
      {laneMarkings}
      {isSelected && (
        <>
          <Line points={flat} stroke={COLORS.selected} strokeWidth={2} dash={[6, 4]} />
          {/* Tangent arms: p0→cp1 and cp2→p3 */}
          <Line points={[p0.x, p0.y, p1.x, p1.y]} stroke="rgba(59,130,246,0.5)" strokeWidth={1} dash={[3, 3]} />
          <Line points={[p2.x, p2.y, p3.x, p3.y]} stroke="rgba(59,130,246,0.5)" strokeWidth={1} dash={[3, 3]} />
          {/* Endpoint handles (green circles) */}
          <Circle x={p0.x} y={p0.y} radius={6} fill={COLORS.success} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Circle x={p3.x} y={p3.y} radius={6} fill={COLORS.success} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          {/* Control point handles (blue circles) */}
          <Circle x={p1.x} y={p1.y} radius={5} fill={COLORS.info} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Circle x={p2.x} y={p2.y} radius={5} fill={COLORS.info} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        </>
      )}
    </Group>
  );
}

interface SignShapeProps { obj: SignObject; isSelected: boolean; }
function SignShape({ obj, isSelected }: SignShapeProps) {
  const { x, y, signData, rotation = 0, scale: sc = 1 } = obj;
  const s = 28 * sc;
  return (
    <Shape
      x={x} y={y}
      rotation={rotation}
      shadowColor={isSelected ? COLORS.selected : undefined}
      shadowBlur={isSelected ? 12 : 0}
      listening={false}
      sceneFunc={(ctx: KonvaContext) => {
        const shp = signData.shape;
        if (shp === "octagon") {
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = Math.PI / 8 + (i * Math.PI) / 4;
            ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
          }
          ctx.closePath();
          ctx.fillStyle = signData.color; ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        } else if (shp === "diamond") {
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
          ctx.closePath();
          ctx.fillStyle = signData.color; ctx.fill();
          ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.stroke();
        } else if (shp === "triangle") {
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.7); ctx.lineTo(-s, s * 0.7);
          ctx.closePath();
          ctx.fillStyle = signData.color; ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        } else if (shp === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, s, 0, Math.PI * 2);
          ctx.fillStyle = signData.color; ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        } else if (shp === "shield") {
          ctx.beginPath();
          ctx.moveTo(-s * 0.7, -s); ctx.lineTo(s * 0.7, -s);
          ctx.lineTo(s * 0.8, -s * 0.3); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, -s * 0.3);
          ctx.closePath();
          ctx.fillStyle = signData.color; ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        } else {
          ctx.fillStyle = signData.color || "#fff";
          ctx.strokeStyle = signData.border || "#333";
          ctx.lineWidth = 2;
          ctx.fillRect(-s, -s * 0.65, s * 2, s * 1.3);
          ctx.strokeRect(-s, -s * 0.65, s * 2, s * 1.3);
        }
        ctx.fillStyle = signData.textColor || "#fff";
        const label = signData.label.length > 12 ? signData.label.slice(0, 11) + "…" : signData.label;
        const baseFontSize = label.length <= 4 ? 13 : label.length <= 8 ? 11 : 8;
        ctx.font = `bold ${Math.max(6, baseFontSize * sc)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 0, shp === "triangle" ? 4 : 0);
      }}
    />
  );
}

interface DeviceShapeProps { obj: DeviceObject; isSelected: boolean; }
function DeviceShape({ obj, isSelected }: DeviceShapeProps) {
  const { x, y, deviceData, rotation = 0 } = obj;
  return (
    <Shape
      x={x} y={y}
      rotation={rotation}
      shadowColor={isSelected ? COLORS.selected : undefined}
      shadowBlur={isSelected ? 12 : 0}
      listening={false}
      sceneFunc={(ctx: KonvaContext) => {
        ctx.fillStyle = deviceData.color;
        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(deviceData.icon, 0, 0);
        ctx.fillStyle = COLORS.textMuted;
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(deviceData.label, 0, 18);
      }}
    />
  );
}

interface WorkZoneProps { obj: ZoneObject; isSelected: boolean; }
function WorkZone({ obj, isSelected }: WorkZoneProps) {
  const { x, y, w, h } = obj;
  const hatches = [];
  const maxD = Math.max(w, h);
  for (let i = -maxD; i < maxD * 2; i += 20) {
    hatches.push(
      <Line key={i} points={[x + i, y, x + i + h, y + h]} stroke="rgba(245,158,11,0.12)" strokeWidth={1} listening={false} />
    );
  }
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={w} height={h} fill="rgba(245,158,11,0.08)"
        stroke={isSelected ? COLORS.selected : "rgba(245,158,11,0.5)"} strokeWidth={2} dash={[8, 6]} />
      {hatches}
      <KonvaText x={x} y={y} width={w} height={h} text="WORK ZONE"
        fontSize={11} fontStyle="bold" fontFamily="'JetBrains Mono', monospace"
        fill={COLORS.accent} align="center" verticalAlign="middle" />
    </Group>
  );
}

interface ArrowShapeProps { obj: ArrowObject; isSelected: boolean; }
function ArrowShape({ obj, isSelected }: ArrowShapeProps) {
  const { x1, y1, x2, y2, color = "#fff" } = obj;
  const angle = angleBetween(x1, y1, x2, y2);
  const headLen = 14;
  const col = isSelected ? COLORS.selected : color;
  const hx1 = x2 - headLen * Math.cos(angle - 0.4);
  const hy1 = y2 - headLen * Math.sin(angle - 0.4);
  const hx2 = x2 - headLen * Math.cos(angle + 0.4);
  const hy2 = y2 - headLen * Math.sin(angle + 0.4);
  return (
    <Group listening={false}>
      <Line points={[x1, y1, x2, y2]} stroke={col} strokeWidth={3} />
      <Line points={[x2, y2, hx1, hy1, hx2, hy2]} closed fill={col} stroke={col} strokeWidth={1} />
    </Group>
  );
}

interface TextLabelProps { obj: TextObject; isSelected: boolean; }
function TextLabel({ obj, isSelected }: TextLabelProps) {
  const { x, y, text, fontSize = 14, bold, color = "#fff" } = obj;
  return (
    <KonvaText x={x} y={y} text={text} fontSize={fontSize}
      fontStyle={bold ? "bold" : "normal"}
      fontFamily="'JetBrains Mono', monospace"
      fill={isSelected ? COLORS.selected : color}
      listening={false} />
  );
}

interface MeasurementShapeProps { obj: MeasureObject; }
function MeasurementShape({ obj }: MeasurementShapeProps) {
  const { x1, y1, x2, y2 } = obj;
  const d = dist(x1, y1, x2, y2);
  const ft = (d * 0.5).toFixed(1);
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  return (
    <Group listening={false}>
      <Line points={[x1, y1, x2, y2]} stroke="#818cf8" strokeWidth={1.5} dash={[5, 5]} />
      <Circle x={x1} y={y1} radius={4} fill="#818cf8" />
      <Circle x={x2} y={y2} radius={4} fill="#818cf8" />
      <Rect x={midX - 28} y={midY - 10} width={56} height={20} fill="#0f1117" stroke="#818cf8" strokeWidth={1} />
      <KonvaText x={midX - 28} y={midY - 10} width={56} height={20} text={`${ft} ft`}
        fontSize={10} fontStyle="bold" fontFamily="'JetBrains Mono', monospace"
        fill="#818cf8" align="center" verticalAlign="middle" />
    </Group>
  );
}

// px per foot — chosen to match road scale (2-lane road = 22 ft realWidth ≈ 80 px → ~3.6 px/ft)
const TAPER_SCALE = 3;

interface TaperShapeProps { obj: TaperObject; isSelected: boolean; }
function TaperShape({ obj, isSelected }: TaperShapeProps) {
  const { x, y, rotation, laneWidth, taperLength, numLanes } = obj;
  const totalWidthPx = laneWidth * numLanes * TAPER_SCALE;
  const narrowHalfPx = (laneWidth * TAPER_SCALE) / 2;
  const lengthPx = taperLength * TAPER_SCALE;
  const hw = totalWidthPx / 2;

  return (
    <Shape
      x={x} y={y} rotation={rotation}
      listening={false}
      shadowColor={isSelected ? COLORS.selected : undefined}
      shadowBlur={isSelected ? 12 : 0}
      sceneFunc={(ctx: KonvaContext) => {
        // Trapezoid: wide end centered at origin, narrow end at +lengthPx
        // Wide end spans ±hw, narrow end spans ±narrowHalfPx (open lane persists)
        ctx.beginPath();
        ctx.moveTo(0, -hw);
        ctx.lineTo(0,  hw);
        ctx.lineTo(lengthPx,  narrowHalfPx);
        ctx.lineTo(lengthPx, -narrowHalfPx);
        ctx.closePath();
        ctx.fillStyle = "rgba(249,115,22,0.35)";
        ctx.fill();
        ctx.strokeStyle = isSelected ? COLORS.selected : "#f97316";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Dashed centerline with arrowhead
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(lengthPx - 18, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(lengthPx - 8, 0);
        ctx.lineTo(lengthPx - 18, -5);
        ctx.lineTo(lengthPx - 18, 5);
        ctx.closePath();
        ctx.fill();
        // L label
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`L=${Math.round(obj.taperLength)}ft`, lengthPx / 2, hw + 14);
      }}
    />
  );
}

interface ObjectShapeProps { obj: CanvasObject; isSelected: boolean; }
function ObjectShape({ obj, isSelected }: ObjectShapeProps) {
  switch (obj.type) {
    case "road":         return <RoadSegment obj={obj} isSelected={isSelected} />;
    case "polyline_road":return <PolylineRoad obj={obj} isSelected={isSelected} />;
    case "curve_road":         return <CurveRoad obj={obj} isSelected={isSelected} />;
    case "cubic_bezier_road":  return <CubicBezierRoad obj={obj} isSelected={isSelected} />;
    case "sign":         return <SignShape obj={obj} isSelected={isSelected} />;
    case "device":       return <DeviceShape obj={obj} isSelected={isSelected} />;
    case "zone":         return <WorkZone obj={obj} isSelected={isSelected} />;
    case "arrow":        return <ArrowShape obj={obj} isSelected={isSelected} />;
    case "text":         return <TextLabel obj={obj} isSelected={isSelected} />;
    case "measure":      return <MeasurementShape obj={obj} />;
    case "taper":        return <TaperShape obj={obj} isSelected={isSelected} />;
    default:             return null;
  }
}

interface DrawingOverlaysProps { tool: string; roadDrawMode: string; drawStart: DrawStart | null; cursorPos: Point; snapIndicator: Point | null; polyPoints: Point[]; curvePoints: Point[]; cubicPoints: Point[]; }
function DrawingOverlays({ tool, roadDrawMode, drawStart, cursorPos, snapIndicator, polyPoints, curvePoints, cubicPoints }: DrawingOverlaysProps) {
  const previewTarget = snapIndicator || cursorPos;
  const elements = [];

  // Straight road preview
  if (drawStart && tool === "road" && roadDrawMode === "straight") {
    elements.push(
      <Line key="road-preview"
        points={[drawStart.x, drawStart.y, previewTarget.x, previewTarget.y]}
        stroke="rgba(245,158,11,0.5)" strokeWidth={1} dash={[6, 4]} listening={false} />
    );
  }

  // Zone preview
  if (drawStart && tool === "zone") {
    const zx = Math.min(drawStart.x, cursorPos.x), zy = Math.min(drawStart.y, cursorPos.y);
    elements.push(
      <Rect key="zone-preview" x={zx} y={zy}
        width={Math.abs(cursorPos.x - drawStart.x)} height={Math.abs(cursorPos.y - drawStart.y)}
        stroke="rgba(245,158,11,0.5)" strokeWidth={1} dash={[6, 4]} listening={false} />
    );
  }

  // Arrow / measure preview
  if (drawStart && (tool === "arrow" || tool === "measure")) {
    elements.push(
      <Line key="line-preview"
        points={[drawStart.x, drawStart.y, cursorPos.x, cursorPos.y]}
        stroke="rgba(245,158,11,0.5)" strokeWidth={1} dash={[6, 4]} listening={false} />
    );
  }

  // Polyline / smooth in-progress
  if (tool === "road" && (roadDrawMode === "poly" || roadDrawMode === "smooth") && polyPoints.length > 0) {
    const flat = [...polyPoints.flatMap((p) => [p.x, p.y]), previewTarget.x, previewTarget.y];
    const previewTension = roadDrawMode === "smooth" ? 0.5 : 0;
    elements.push(
      <Line key="poly-preview" points={flat}
        stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} tension={previewTension} listening={false} />
    );
    polyPoints.forEach((p, idx) => {
      elements.push(
        <Circle key={`poly-pt-${idx}`} x={p.x} y={p.y} radius={5}
          fill={idx === 0 ? COLORS.success : COLORS.accent}
          stroke="rgba(255,255,255,0.6)" strokeWidth={1} listening={false} />
      );
    });
  }

  // Curve in-progress
  if (tool === "road" && roadDrawMode === "curve" && curvePoints.length > 0) {
    if (curvePoints.length === 1) {
      elements.push(
        <Line key="curve-preview-1"
          points={[curvePoints[0].x, curvePoints[0].y, previewTarget.x, previewTarget.y]}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} listening={false} />
      );
    } else {
      const previewSpine = sampleBezier(curvePoints[0], curvePoints[1], previewTarget, 20);
      elements.push(
        <Line key="curve-preview-2" points={previewSpine.flatMap((p) => [p.x, p.y])}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} tension={0} listening={false} />
      );
      elements.push(
        <Line key="curve-tangent"
          points={[curvePoints[0].x, curvePoints[0].y, curvePoints[1].x, curvePoints[1].y, previewTarget.x, previewTarget.y]}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} dash={[3, 3]} listening={false} />
      );
    }
    curvePoints.forEach((p, idx) => {
      elements.push(
        <Circle key={`curve-pt-${idx}`} x={p.x} y={p.y} radius={5}
          fill={idx === 0 ? COLORS.success : COLORS.info}
          stroke="rgba(255,255,255,0.6)" strokeWidth={1} listening={false} />
      );
    });
  }

  // Cubic bezier in-progress
  if (tool === "road" && roadDrawMode === "cubic" && cubicPoints.length > 0) {
    const [q0, q1, q2] = cubicPoints;
    if (cubicPoints.length === 1) {
      // Step 1: line from p0 to cursor
      elements.push(
        <Line key="cubic-preview-1"
          points={[q0.x, q0.y, previewTarget.x, previewTarget.y]}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} listening={false} />
      );
    } else if (cubicPoints.length === 2) {
      // Step 2: cp1 placed, collapse cp2+p3 to cursor for preview
      const spine = sampleCubicBezier(q0, q1, previewTarget, previewTarget, 20);
      elements.push(
        <Line key="cubic-preview-2" points={spine.flatMap((p) => [p.x, p.y])}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} tension={0} listening={false} />
      );
      elements.push(
        <Line key="cubic-tangent-1"
          points={[q0.x, q0.y, q1.x, q1.y]}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} dash={[3, 3]} listening={false} />
      );
    } else {
      // Step 3: cp1 + cp2 placed, preview p3 at cursor
      const spine = sampleCubicBezier(q0, q1, q2, previewTarget, 20);
      elements.push(
        <Line key="cubic-preview-3" points={spine.flatMap((p) => [p.x, p.y])}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} tension={0} listening={false} />
      );
      elements.push(
        <Line key="cubic-tangent-1"
          points={[q0.x, q0.y, q1.x, q1.y]}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} dash={[3, 3]} listening={false} />
      );
      elements.push(
        <Line key="cubic-tangent-2"
          points={[q2.x, q2.y, previewTarget.x, previewTarget.y]}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} dash={[3, 3]} listening={false} />
      );
    }
    cubicPoints.forEach((p, idx) => {
      elements.push(
        <Circle key={`cubic-pt-${idx}`} x={p.x} y={p.y} radius={5}
          fill={idx === 0 ? COLORS.success : COLORS.info}
          stroke="rgba(255,255,255,0.6)" strokeWidth={1} listening={false} />
      );
    });
  }

  // Snap indicator
  if (snapIndicator) {
    elements.push(
      <Circle key="snap-outer" x={snapIndicator.x} y={snapIndicator.y} radius={9}
        stroke={COLORS.success} strokeWidth={2} listening={false} />
    );
    elements.push(
      <Circle key="snap-inner" x={snapIndicator.x} y={snapIndicator.y} radius={3}
        fill={COLORS.success} listening={false} />
    );
  }

  return <>{elements}</>;
}

// ─── UI COMPONENTS ─────────────────────────────────────────────────────────────

interface ToolButtonProps { tool: ToolDef; active: boolean; onClick: () => void; }
function ToolButton({ tool, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
      data-testid={`tool-${tool.id}`}
      aria-pressed={active}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, borderRadius: 8,
        border: active ? `2px solid ${COLORS.accent}` : "1px solid transparent",
        background: active ? COLORS.accentDim : "transparent",
        color: active ? COLORS.accent : COLORS.textMuted,
        cursor: "pointer", fontSize: 18, transition: "all 0.15s", position: "relative",
      }}
    >
      <span>{tool.icon}</span>
      <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: 7, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
        {tool.shortcut}
      </span>
    </button>
  );
}

// ─── SIGN EDITOR PANEL ───────────────────────────────────────────────────────

interface SignEditorPanelProps { onUseSign: (signData: SignData) => void; onSaveToLibrary: (signData: SignData) => void; onSignChange: (signData: SignData) => void; }
function SignEditorPanel({ onUseSign, onSaveToLibrary, onSignChange }: SignEditorPanelProps) {
  const [shape, setShape] = useState<SignShape>("diamond");
  const [text, setText] = useState("CUSTOM");
  const [bgColor, setBgColor] = useState("#f97316");
  const [textColor, setTextColor] = useState("#111111");
  const previewRef = useRef<HTMLCanvasElement>(null);

  const signData = useMemo(() => ({
    id: "custom_preview",
    label: text || " ",
    shape,
    color: bgColor,
    textColor,
    border: "#333",
  }), [shape, text, bgColor, textColor]);

  // Keep parent's selectedSign in sync so clicking the canvas always places
  // the current editor sign (not whatever was last selected from the library).
  useEffect(() => { onSignChange(signData) }, [signData, onSignChange]);

  useEffect(() => {
    const cvs = previewRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 100, 100);
    ctx.fillStyle = COLORS.canvas;
    ctx.fillRect(0, 0, 100, 100);
    drawSign(ctx, { x: 50, y: 50, signData, rotation: 0, scale: 1.5 }, false);
  }, [signData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sectionTitle("Shape")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {SIGN_SHAPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setShape(s.id as SignShape)}
            style={{
              padding: "6px 4px",
              background: shape === s.id ? COLORS.accentDim : "rgba(255,255,255,0.03)",
              border: `1px solid ${shape === s.id ? COLORS.accent : COLORS.panelBorder}`,
              borderRadius: 4,
              color: shape === s.id ? COLORS.accent : COLORS.textMuted,
              cursor: "pointer", fontSize: 10, fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{s.preview}</span>
            <span style={{ fontSize: 8 }}>{s.label}</span>
          </button>
        ))}
      </div>

      {sectionTitle("Sign Text")}
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 14))}
        style={{
          background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`,
          color: COLORS.text, padding: "6px 8px", borderRadius: 4,
          fontSize: 12, fontFamily: "inherit", outline: "none",
        }}
        placeholder="SIGN TEXT"
      />

      {sectionTitle("Colors")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 10, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 4 }}>
          Background
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
            style={{ width: "100%", height: 28, cursor: "pointer", border: "none", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 10, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 4 }}>
          Text Color
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
            style={{ width: "100%", height: 28, cursor: "pointer", border: "none", borderRadius: 4 }} />
        </label>
      </div>

      {sectionTitle("Preview")}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <canvas ref={previewRef} width={100} height={100}
          style={{ borderRadius: 6, border: `1px solid ${COLORS.panelBorder}` }} />
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => onUseSign(signData)}
          style={{
            flex: 1, padding: "8px 0", background: COLORS.accentDim,
            border: `1px solid ${COLORS.accent}`, borderRadius: 6,
            color: COLORS.accent, cursor: "pointer", fontSize: 11,
            fontFamily: "inherit", fontWeight: 600, letterSpacing: 0.5,
          }}
        >
          ✓ Place
        </button>
        <button
          onClick={() => onSaveToLibrary({ ...signData, id: "custom_" + uid() })}
          style={{
            flex: 1, padding: "8px 0", background: "transparent",
            border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6,
            color: COLORS.textMuted, cursor: "pointer", fontSize: 11,
            fontFamily: "inherit", fontWeight: 600, letterSpacing: 0.5,
          }}
        >
          + Save
        </button>
      </div>
    </div>
  );
}

// ─── SIGN ICON SVG ────────────────────────────────────────────────────────────

function SignIconSvg({ signData, size = 22 }: { signData: SignData; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const { shape, color, textColor, label } = signData;
  let shapeEl: React.ReactElement;
  if (shape === "octagon") {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    }).join(" ");
    shapeEl = <polygon points={pts} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else if (shape === "diamond") {
    shapeEl = <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={color} stroke="#111" strokeWidth="1.5" />;
  } else if (shape === "triangle") {
    shapeEl = <polygon points={`${cx},${cy - r} ${cx + r},${cy + r * 0.7} ${cx - r},${cy + r * 0.7}`} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else if (shape === "circle") {
    shapeEl = <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else if (shape === "shield") {
    shapeEl = <polygon points={`${cx - r * 0.7},${cy - r} ${cx + r * 0.7},${cy - r} ${cx + r * 0.8},${cy - r * 0.3} ${cx},${cy + r} ${cx - r * 0.8},${cy - r * 0.3}`} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else {
    shapeEl = <rect x={cx - r} y={cy - r * 0.65} width={r * 2} height={r * 1.3} fill={color} stroke={signData.border || "#333"} strokeWidth="1.5" />;
  }
  const shortLabel = label.length > 5 ? label.slice(0, 4) + "\u2026" : label;
  const fontSize = label.length <= 3 ? 6 : label.length <= 5 ? 5 : 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-hidden="true">
      {shapeEl}
      <text x={cx} y={shape === "triangle" ? cy + r * 0.3 : cy + 1.5} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight="bold" fill={textColor || "#fff"} fontFamily="'JetBrains Mono',monospace">
        {shortLabel}
      </text>
    </svg>
  );
}

// ─── LEGEND BOX ───────────────────────────────────────────────────────────────

interface LegendBoxProps { objects: CanvasObject[]; visible: boolean; }
function LegendBox({ objects, visible }: LegendBoxProps) {
  const { signEntries, deviceEntries } = useMemo(() => {
    const signMap: Record<string, { signData: SignData; count: number }> = {};
    const deviceMap: Record<string, { id: string; icon: string; label: string; count: number }> = {};
    for (const obj of objects) {
      if (obj.type === "sign") {
        const key = obj.signData.id;
        if (!signMap[key]) signMap[key] = { signData: obj.signData, count: 0 };
        signMap[key].count++;
      } else if (obj.type === "device") {
        const key = obj.deviceData.id;
        if (!deviceMap[key]) deviceMap[key] = { id: key, icon: obj.deviceData.icon, label: obj.deviceData.label, count: 0 };
        deviceMap[key].count++;
      }
    }
    return {
      signEntries: Object.values(signMap),
      deviceEntries: Object.values(deviceMap),
    };
  }, [objects]);

  if (!visible || (signEntries.length === 0 && deviceEntries.length === 0)) return null;

  return (
    <div data-testid="legend-box" style={{
      position: "absolute", bottom: STATUS_BAR_H + 8, left: 12,
      background: "rgba(26,29,39,0.92)", border: `1px solid ${COLORS.panelBorder}`,
      borderRadius: 6, padding: "6px 8px", pointerEvents: "none", zIndex: 10,
      minWidth: 130, maxWidth: 200,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>
        Legend
      </div>
      {signEntries.map(({ signData, count }) => (
        <div key={signData.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <SignIconSvg signData={signData} size={20} />
          <span data-testid="legend-item-label" style={{ fontSize: 10, color: COLORS.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signData.label}</span>
          <span data-testid="legend-count" style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: COLORS.text, fontWeight: 600 }}>{count}</span>
        </div>
      ))}
      {deviceEntries.map(({ id, label, icon, count }) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 20, textAlign: "center", fontSize: 13, flexShrink: 0 }} aria-hidden="true">{icon}</span>
          <span data-testid="legend-item-label" style={{ fontSize: 10, color: COLORS.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <span data-testid="legend-count" style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: COLORS.text, fontWeight: 600 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── NORTH ARROW ─────────────────────────────────────────────────────────────

const northArrowStyle: React.CSSProperties = {
  position: "absolute",
  bottom: STATUS_BAR_H + 8,
  right: 12,
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "rgba(26,29,39,0.88)",
  border: `1px solid ${COLORS.panelBorder}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 10,
};

function NorthArrow({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div data-testid="north-arrow" style={northArrowStyle}>
      <svg width="36" height="36" viewBox="0 0 36 36" role="img">
        <title>North arrow</title>
        {/* North needle */}
        <polygon points="18,5 15,19 21,19" fill={COLORS.danger} />
        {/* South needle (muted) */}
        <polygon points="18,31 15,19 21,19" fill={COLORS.textDim} />
        {/* Centre pivot */}
        <circle cx="18" cy="19" r="2.5" fill={COLORS.text} />
        {/* N label */}
        <text x="18" y="4" textAnchor="middle" dominantBaseline="auto" fontSize="7" fontWeight="bold" fill={COLORS.danger} fontFamily="'JetBrains Mono',monospace">N</text>
      </svg>
    </div>
  );
}

// ─── MANIFEST PANEL ──────────────────────────────────────────────────────────

function ManifestRow({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 10, color: COLORS.textMuted }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        {label}
      </span>
      <span data-testid="manifest-count" style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.text, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

function ManifestPanel({ objects }: { objects: CanvasObject[] }) {
  const {
    signCounts,
    deviceCounts,
    roads,
    tapers,
    zones,
    arrows,
    texts,
    measures,
    hasAny,
    otherCount,
  } = useMemo(() => {
    const nextSignCounts: Record<string, number> = {};
    const nextDeviceCounts: Record<string, number> = {};
    let roadsCount = 0;
    let tapersCount = 0;
    let zonesCount = 0;
    let arrowsCount = 0;
    let textsCount = 0;
    let measuresCount = 0;

    for (const obj of objects) {
      if (obj.type === "sign") {
        nextSignCounts[obj.signData.label] = (nextSignCounts[obj.signData.label] ?? 0) + 1;
      } else if (obj.type === "device") {
        nextDeviceCounts[obj.deviceData.label] = (nextDeviceCounts[obj.deviceData.label] ?? 0) + 1;
      } else if (isRoad(obj)) {
        roadsCount++;
      } else if (obj.type === "taper") {
        tapersCount++;
      } else if (obj.type === "zone") {
        zonesCount++;
      } else if (obj.type === "arrow") {
        arrowsCount++;
      } else if (obj.type === "text") {
        textsCount++;
      } else if (obj.type === "measure") {
        measuresCount++;
      }
    }

    const hasAnyObjects = objects.length > 0;
    const otherCountTotal =
      roadsCount + tapersCount + zonesCount + arrowsCount + textsCount + measuresCount;

    return {
      signCounts: nextSignCounts,
      deviceCounts: nextDeviceCounts,
      roads: roadsCount,
      tapers: tapersCount,
      zones: zonesCount,
      arrows: arrowsCount,
      texts: textsCount,
      measures: measuresCount,
      hasAny: hasAnyObjects,
      otherCount: otherCountTotal,
    };
  }, [objects]);
  return (
    <div data-testid="manifest-panel" style={{ padding: 12, overflow: "auto", flex: 1 }}>
      {!hasAny && <div style={{ fontSize: 10, color: COLORS.textDim, textAlign: "center", padding: 12 }}>No objects yet</div>}
      {Object.keys(signCounts).length > 0 && (
        <>{sectionTitle("Signs")}
          {Object.entries(signCounts).map(([label, count]) => (
            <ManifestRow key={label} icon="⬡" label={label} count={count} />
          ))}
        </>
      )}
      {Object.keys(deviceCounts).length > 0 && (
        <>{sectionTitle("Devices")}
          {Object.entries(deviceCounts).map(([label, count]) => (
            <ManifestRow key={label} icon="▲" label={label} count={count} />
          ))}
        </>
      )}
      {otherCount > 0 && (
        <>{sectionTitle("Other")}
          {roads   > 0 && <ManifestRow icon="━" label="Road segments" count={roads} />}
          {tapers  > 0 && <ManifestRow icon="⋈" label="Tapers"        count={tapers} />}
          {zones   > 0 && <ManifestRow icon="▨" label="Work zones"    count={zones} />}
          {arrows  > 0 && <ManifestRow icon="→" label="Arrows"        count={arrows} />}
          {texts   > 0 && <ManifestRow icon="T" label="Text labels"   count={texts} />}
          {measures > 0 && <ManifestRow icon="📏" label="Measurements" count={measures} />}
        </>
      )}
      {hasAny && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.panelBorder}`, display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMuted }}>
          <span>Total</span>
          <span data-testid="manifest-count" style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.text, fontWeight: 600 }}>{objects.length}</span>
        </div>
      )}
    </div>
  );
}

// ─── QC PANEL ────────────────────────────────────────────────────────────────

function getQCBadgeColor(issues: QCIssue[]): string | null {
  if (issues.some(i => i.severity === "error"))   return "#ef4444";
  if (issues.some(i => i.severity === "warning")) return "#f59e0b";
  return null;
}

function QCPanel({ issues }: { issues: QCIssue[] }) {
  const SEV_COLOR = { error: "#ef4444", warning: "#f59e0b", info: "#64748b" } as const;
  const SEV_ICON  = { error: "✕", warning: "⚠", info: "ℹ" } as const;
  const errorCount   = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const infoCount    = issues.filter(i => i.severity === "info").length;
  return (
    <div data-testid="qc-panel" style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      {issues.length === 0 ? (
        <div style={{ textAlign: "center", color: "#22c55e", fontSize: 11, padding: "24px 0" }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>✓</div>
          No issues found
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
            {errorCount} error{errorCount !== 1 ? "s" : ""},{" "}
            {warningCount} warning{warningCount !== 1 ? "s" : ""}
            {infoCount > 0 && `, ${infoCount} info`}
          </div>
          {issues.map(issue => (
            <div key={issue.id} data-testid={`qc-issue-${issue.severity}`}
              style={{ padding: "8px 10px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: `1px solid ${SEV_COLOR[issue.severity]}33`, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: SEV_COLOR[issue.severity], fontSize: 12, flexShrink: 0, marginTop: 1 }}>{SEV_ICON[issue.severity]}</span>
              <span style={{ fontSize: 10, color: "#cbd5e1", lineHeight: 1.4 }}>{issue.message}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── PROPERTY PANEL ──────────────────────────────────────────────────────────

interface PropertyPanelProps { selected: string | null; objects: CanvasObject[]; onUpdate: (id: string, updates: Record<string, unknown>) => void; onDelete: (id: string) => void; onReorder: (id: string, dir: "front" | "forward" | "backward" | "back") => void; planMeta: PlanMeta; onUpdateMeta: (meta: PlanMeta) => void; }
function PropertyPanel({ selected, objects, onUpdate, onDelete, onReorder, planMeta, onUpdateMeta }: PropertyPanelProps) {
  if (!selected) {
    return (
      <div style={{ padding: 12 }}>
        {sectionTitle("Plan Info")}
        {([["Project #", "projectNumber"], ["Client", "client"], ["Location", "location"]] as Array<[string, keyof PlanMeta]>).map(([label, key]) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, fontSize: 11, color: COLORS.textMuted }}>
            {label}
            <input value={planMeta[key]} onChange={(e) => onUpdateMeta({ ...planMeta, [key]: e.target.value })}
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "5px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit", outline: "none" }} />
          </label>
        ))}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: COLORS.textMuted }}>
          Notes
          <textarea value={planMeta.notes} onChange={(e) => onUpdateMeta({ ...planMeta, notes: e.target.value })}
            rows={3} style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "5px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
        </label>
      </div>
    );
  }
  const obj = objects.find((o) => o.id === selected);
  if (!obj) return null;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {obj.type === "polyline_road" ? "Polyline Road" : obj.type === "curve_road" ? "Quad Bézier Road" : obj.type === "cubic_bezier_road" ? "Cubic Bézier Road" : obj.type === "taper" ? "Taper" : obj.type} Properties
      </div>

      {obj.type === "sign" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Rotation: {obj.rotation || 0}°
            <input type="range" min="0" max="360" value={obj.rotation || 0}
              onChange={(e) => onUpdate(obj.id, { rotation: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Scale: {(obj.scale || 1).toFixed(1)}
            <input type="range" min="0.5" max="3" step="0.1" value={obj.scale || 1}
              onChange={(e) => onUpdate(obj.id, { scale: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
        </div>
      )}

      {obj.type === "device" && (
        <label style={{ fontSize: 11, color: COLORS.textMuted }}>
          Rotation: {obj.rotation || 0}°
          <input type="range" min="0" max="360" value={obj.rotation || 0}
            onChange={(e) => onUpdate(obj.id, { rotation: +e.target.value })}
            style={{ width: "100%", accentColor: COLORS.accent }} />
        </label>
      )}

      {obj.type === "taper" && (() => {
        const t = obj as TaperObject;
        const autoLen = calcTaperLength(t.speed, t.laneWidth, t.numLanes);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Speed: {t.speed} mph
              <input type="range" min={25} max={65} step={5} value={t.speed}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => {
                  const speed = +e.target.value;
                  onUpdate(t.id, { speed, ...(!t.manualLength && { taperLength: calcTaperLength(speed, t.laneWidth, t.numLanes) }) });
                }} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Lane Width: {t.laneWidth} ft
              <input type="range" min={10} max={16} step={1} value={t.laneWidth}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => {
                  const laneWidth = +e.target.value;
                  onUpdate(t.id, { laneWidth, ...(!t.manualLength && { taperLength: calcTaperLength(t.speed, laneWidth, t.numLanes) }) });
                }} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Lanes Closed: {t.numLanes}
              <input type="range" min={1} max={2} step={1} value={t.numLanes}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => {
                  const numLanes = +e.target.value;
                  onUpdate(t.id, { numLanes, ...(!t.manualLength && { taperLength: calcTaperLength(t.speed, t.laneWidth, numLanes) }) });
                }} />
            </label>
            <div style={{ fontSize: 11, color: COLORS.accent, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 4, padding: "4px 8px" }}>
              MUTCD L = {autoLen} ft
            </div>
            <label style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={t.manualLength}
                onChange={(e) => onUpdate(t.id, { manualLength: e.target.checked, taperLength: e.target.checked ? t.taperLength : autoLen })} />
              Manual override
            </label>
            {t.manualLength && (
              <label style={{ fontSize: 11, color: COLORS.textMuted }}>
                Length: {t.taperLength} ft
                <input type="range" min={50} max={2000} step={10} value={t.taperLength}
                  style={{ width: "100%", accentColor: COLORS.accent }}
                  onChange={(e) => onUpdate(t.id, { taperLength: +e.target.value })} />
              </label>
            )}
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Rotation: {t.rotation}°
              <input type="range" min={0} max={360} value={t.rotation}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(t.id, { rotation: +e.target.value })} />
            </label>
          </div>
        );
      })()}

      {obj.type === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={obj.text} onChange={(e) => onUpdate(obj.id, { text: e.target.value })}
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "6px 8px", borderRadius: 4, fontSize: 12 }} />
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Font Size: {obj.fontSize || 14}
            <input type="range" min="8" max="48" value={obj.fontSize || 14}
              onChange={(e) => onUpdate(obj.id, { fontSize: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={obj.bold || false}
              onChange={(e) => onUpdate(obj.id, { bold: e.target.checked })} />
            Bold
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Color
            <input type="color" value={obj.color || "#ffffff"}
              onChange={(e) => onUpdate(obj.id, { color: e.target.value })}
              style={{ width: "100%", height: 24, cursor: "pointer" }} />
          </label>
        </div>
      )}

      {isMultiPointRoad(obj) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {obj.type === "polyline_road"
              ? `Polyline — ${obj.points.length} points`
              : obj.type === "cubic_bezier_road"
              ? "Cubic Bézier curve — drag handles to reshape"
              : "Quadratic Bézier curve"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {obj.roadType} · {obj.lanes} lanes · {obj.width}px wide
          </div>
        </div>
      )}

      {/* ── Position inputs ────────────────────────────────────────── */}
      {isPointObject(obj) && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {(["x", "y"] as const).map((axis) => (
            <label key={axis} style={{ flex: 1, fontSize: 11, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 2 }}>
              {axis.toUpperCase()}
              <input type="number" step="any" value={obj[axis]}
                onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onUpdate(obj.id, { [axis]: v }); }}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: "100%", outline: "none" }} />
            </label>
          ))}
        </div>
      )}
      {isLineObject(obj) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["x1", "y1"] as const).map((k) => (
              <label key={k} style={{ flex: 1, fontSize: 11, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 2 }}>
                {k.toUpperCase()}
                <input type="number" step="any" value={obj[k]}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onUpdate(obj.id, { [k]: v }); }}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: "100%", outline: "none" }} />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["x2", "y2"] as const).map((k) => (
              <label key={k} style={{ flex: 1, fontSize: 11, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 2 }}>
                {k.toUpperCase()}
                <input type="number" step="any" value={obj[k]}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onUpdate(obj.id, { [k]: v }); }}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: "100%", outline: "none" }} />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Z-ordering ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Layer order</div>
        <div style={{ display: "flex", gap: 4 }}>
          {([
            ["▲▲", "front", "Bring to Front"],
            ["▲",  "forward",  "Bring Forward"],
            ["▼",  "backward", "Send Backward"],
            ["▼▼", "back",   "Send to Back"],
          ] as [string, "front" | "forward" | "backward" | "back", string][]).map(([icon, dir, title]) => (
            <button key={dir} title={title} aria-label={title} onClick={() => onReorder(obj.id, dir)}
              style={{ flex: 1, padding: "4px 0", background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textMuted, borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onDelete(obj.id)}
        style={{
          marginTop: 10, width: "100%", padding: "6px 0",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          color: COLORS.danger, borderRadius: 6, cursor: "pointer",
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        Delete Object
      </button>
    </div>
  );
}

// ─── MERCATOR HELPERS ─────────────────────────────────────────────────────────

function latLonToPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const scale = Math.pow(2, zoom) * 256;
  const x = ((lon + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function pixelToLatLon(px: number, py: number, zoom: number): { lat: number; lon: number } {
  const scale = Math.pow(2, zoom) * 256;
  const lon = (px / scale) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * py / scale))) * 180 / Math.PI;
  return { lat, lon };
}

// ─── MINI MAP ─────────────────────────────────────────────────────────────────

interface MiniMapProps { objects: CanvasObject[]; canvasSize: { w: number; h: number }; zoom: number; offset: Point; mapCenter: MapCenter | null; }
function MiniMap({ objects, canvasSize, zoom, offset, mapCenter }: MiniMapProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mmW = 160, mmH = 100;
  const tileCache = useRef<Record<string, HTMLImageElement>>({});
  const [tileTick, setTileTick] = useState(0);

  // Overview zoom: 5 levels above the working zoom gives a useful neighbourhood view
  const ovZoom = mapCenter ? Math.max(8, Math.min(11, mapCenter.zoom - 4)) : null;

  // Clear tile cache when overview zoom level changes to avoid stale tiles
  useEffect(() => { tileCache.current = {}; }, [ovZoom]);

  // Fetch overview tiles whenever mapCenter changes
  useEffect(() => {
    if (!mapCenter || ovZoom === null) return;
    const TILE = 256;
    const { x: cx, y: cy } = latLonToPixel(mapCenter.lat, mapCenter.lon, ovZoom);
    const left = cx - mmW / 2, top = cy - mmH / 2;
    const maxT = Math.pow(2, ovZoom);
    const txStart = Math.floor(left / TILE), txEnd = Math.floor((left + mmW) / TILE);
    const tyStart = Math.floor(top / TILE), tyEnd = Math.floor((top + mmH) / TILE);
    for (let tx = txStart; tx <= txEnd; tx++) {
      for (let ty = tyStart; ty <= tyEnd; ty++) {
        if (ty < 0 || ty >= maxT) continue;
        const wx = ((tx % maxT) + maxT) % maxT;
        const url = `https://tile.openstreetmap.org/${ovZoom}/${wx}/${ty}.png`;
        if (tileCache.current[url]) continue;
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => setTileTick(t => t + 1);
        img.src = url;
        tileCache.current[url] = img;
      }
    }
  }, [mapCenter, ovZoom]);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mmW, mmH);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, mmW, mmH);

    if (mapCenter && ovZoom !== null) {
      // ── Draw overview tiles ──────────────────────────────────────────────
      const TILE = 256;
      const { x: cx, y: cy } = latLonToPixel(mapCenter.lat, mapCenter.lon, ovZoom);
      const left = cx - mmW / 2, top = cy - mmH / 2;
      const maxT = Math.pow(2, ovZoom);
      const txStart = Math.floor(left / TILE), txEnd = Math.floor((left + mmW) / TILE);
      const tyStart = Math.floor(top / TILE), tyEnd = Math.floor((top + mmH) / TILE);
      for (let tx = txStart; tx <= txEnd; tx++) {
        for (let ty = tyStart; ty <= tyEnd; ty++) {
          if (ty < 0 || ty >= maxT) continue;
          const wx = ((tx % maxT) + maxT) % maxT;
          const url = `https://tile.openstreetmap.org/${ovZoom}/${wx}/${ty}.png`;
          const img = tileCache.current[url];
          if (!img?.complete || !img.naturalWidth) continue;
          ctx.drawImage(img, tx * TILE - left, ty * TILE - top, TILE, TILE);
        }
      }
      // Slight dark overlay for contrast with the accent viewport rect
      ctx.fillStyle = "rgba(15,17,23,0.25)";
      ctx.fillRect(0, 0, mmW, mmH);

      // ── Viewport rect ───────────────────────────────────────────────────
      // mapCenter tracks the geographic center of the canvas view (updated on pan),
      // so the viewport is always centred in the minimap.
      const vpScale = Math.pow(2, ovZoom - mapCenter.zoom);
      const vw = Math.max(2, Math.min(mmW, canvasSize.w * vpScale));
      const vh = Math.max(2, Math.min(mmH, canvasSize.h * vpScale));
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5;
      ctx.strokeRect(mmW / 2 - vw / 2, mmH / 2 - vh / 2, vw, vh);
    } else {
      // ── No map: draw canvas objects on a fixed world grid ───────────────
      const worldW = 4000, worldH = 3000;
      const s = Math.min(mmW / worldW, mmH / worldH);
      objects.forEach((obj) => {
        if (obj.type === "road") {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((obj.x1 + 2000) * s, (obj.y1 + 1500) * s);
          ctx.lineTo((obj.x2 + 2000) * s, (obj.y2 + 1500) * s);
          ctx.stroke();
        } else if (obj.type === "polyline_road" && obj.points?.length >= 2) {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          obj.points.forEach((p, i) => {
            const mx = (p.x + 2000) * s, my = (p.y + 1500) * s;
            if (i === 0) { ctx.moveTo(mx, my); } else { ctx.lineTo(mx, my); }
          });
          ctx.stroke();
        } else if (obj.type === "curve_road" && obj.points?.length === 3) {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((obj.points[0].x + 2000) * s, (obj.points[0].y + 1500) * s);
          ctx.quadraticCurveTo(
            (obj.points[1].x + 2000) * s, (obj.points[1].y + 1500) * s,
            (obj.points[2].x + 2000) * s, (obj.points[2].y + 1500) * s
          );
          ctx.stroke();
        } else if (obj.type === "cubic_bezier_road" && obj.points?.length === 4) {
          ctx.strokeStyle = COLORS.road; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo((obj.points[0].x + 2000) * s, (obj.points[0].y + 1500) * s);
          ctx.bezierCurveTo(
            (obj.points[1].x + 2000) * s, (obj.points[1].y + 1500) * s,
            (obj.points[2].x + 2000) * s, (obj.points[2].y + 1500) * s,
            (obj.points[3].x + 2000) * s, (obj.points[3].y + 1500) * s,
          );
          ctx.stroke();
        } else if (isPointObject(obj)) {
          ctx.fillStyle = COLORS.accent;
          ctx.fillRect((obj.x + 2000) * s - 1, (obj.y + 1500) * s - 1, 3, 3);
        }
      });
      // Viewport rect — clamped so it never escapes the minimap bounds
      const vx = (-offset.x / zoom + 2000) * s;
      const vy = (-offset.y / zoom + 1500) * s;
      const vw = Math.min((canvasSize.w / zoom) * s, mmW);
      const vh = Math.min((canvasSize.h / zoom) * s, mmH);
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1;
      ctx.strokeRect(Math.max(0, vx), Math.max(0, vy), Math.min(vw, mmW - Math.max(0, vx)), Math.min(vh, mmH - Math.max(0, vy)));
    }
  }, [objects, canvasSize, zoom, offset, mapCenter, ovZoom, tileTick]);

  return (
    <canvas ref={ref} width={mmW} height={mmH}
      style={{ borderRadius: 6, border: `1px solid ${COLORS.panelBorder}` }} />
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
interface PlannerProps {
  userId?: string | null;
  userEmail?: string | null;
  onSignOut?: () => void;
}

const CLOUD_ENABLED = Boolean(import.meta.env.VITE_S3_BUCKET && import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID);
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || 'jfisher@fisherconsulting.org';
const BANNER_KEY = 'tcp_prebeta_banner_dismissed';

export default function TrafficControlPlanner({ userId = null, userEmail = null, onSignOut }: PlannerProps = {}) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read autosave once — reused by all useState initializers below
  const initialAutosave = useRef(readAutosave()).current;

  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem(BANNER_KEY) === '1');

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
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [mapRenderTick, setMapRenderTick] = useState(0);
  const mapTileCacheRef = useRef<Record<string, MapTileEntry>>({});

  const [roadDrawMode, setRoadDrawMode] = useState("straight");
  const [intersectionType, setIntersectionType] = useState<'t' | '4way'>('4way');
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  const [cubicPoints, setCubicPoints] = useState<Point[]>([]);
  const [snapIndicator, setSnapIndicator] = useState<Point | null>(null);
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
        tiles.push({ url: `https://tile.openstreetmap.org/${zoomLevel}/${wrappedX}/${ty}.png`, x: tx * tileSize - left, y: ty * tileSize - top, size: tileSize });
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
      }));
      setAutosaveError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[TCP] Auto-save failed:", msg);
      setAutosaveError(msg);
    }
  }, [objects, planTitle, planMeta, planId, planCreatedAt, zoom, offset]);

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

      const t = TOOLS.find((t) => t.shortcut === key);
      if (t) switchTool(t.id);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, objects, clipboard, undo, redo, pushHistory, tool, roadDrawMode, polyPoints, selectedRoadType, switchTool]);

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

    if (["zone", "arrow", "measure"].includes(tool)) {
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

    if (drawStart && ["zone", "arrow", "measure"].includes(tool)) {
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
    const newMapCenter = (data.mapCenter as MapCenter | null | undefined) ?? null;
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
        <div data-testid="toolbar" style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, overflow: "hidden" }}>
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
          <button onClick={exportPDF} data-testid="export-pdf-button" style={{ ...panelBtnStyle(false), background: COLORS.accentDim, color: COLORS.accent, borderColor: "rgba(245,158,11,0.35)" }} title="Export plan as PDF">↓ PDF</button>
          <input ref={fileInputRef} type="file" accept=".json,.tcp.json" onChange={loadPlan} style={{ display: "none" }} />
        </div>

        {/* Right-side user controls — flexShrink:0 so toolbar overflow never pushes these off screen */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderLeft: `1px solid ${COLORS.panelBorder}`, paddingLeft: 12, marginLeft: 4 }}>
          <button onClick={() => window.open("/feedback.html", "_blank", "noopener,noreferrer")} style={panelBtnStyle(false)} title="Report an issue or submit feedback">Report Issue</button>
          <a href={`mailto:${CONTACT_EMAIL}`} data-testid="contact-email" style={{ fontSize: 10, color: COLORS.textDim, textDecoration: "none", whiteSpace: "nowrap" }} title="Email support">{CONTACT_EMAIL}</a>
          {onSignOut && (<>
            {(userEmail || userId) && (
              <span data-testid="user-identity" style={{ fontSize: 10, color: COLORS.textMuted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={userEmail ?? userId ?? ''}>
                {userEmail ?? userId}
              </span>
            )}
            <button onClick={onSignOut} data-testid="sign-out-button" style={panelBtnStyle(false)}>Sign Out</button>
          </>)}
        </div>

        <div style={{ position: "relative", flex: "0 1 420px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchStatus(""); }}
              onKeyDown={(e) => e.key === "Enter" && doAddressSearch()}
              placeholder="Search address…"
              style={{ flex: 1, padding: "5px 10px", fontSize: 11, background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, borderRadius: 5, fontFamily: "inherit", outline: "none" }}
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
                    <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => switchTool(t.id)} />
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
                                <button key={sign.id} onClick={() => { setSelectedSign(sign); switchTool("sign"); }}
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
                        <button key={sign.id} onClick={() => { setSelectedSign(sign); switchTool("sign"); }}
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
                              <button onClick={() => { setSelectedSign(sign); switchTool("sign"); }}
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
                    onSignChange={(signData) => setSelectedSign(signData)}
                    onUseSign={() => switchTool("sign")}
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
                    <button key={dev.id} onClick={() => { setSelectedDevice(dev); switchTool("device"); }}
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
                      onClick={() => { setRoadDrawMode(mode.id); switchTool("road"); }}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 9, background: roadDrawMode === mode.id && tool === "road" ? COLORS.accentDim : "rgba(255,255,255,0.03)", border: `1px solid ${roadDrawMode === mode.id && tool === "road" ? COLORS.accent : COLORS.panelBorder}`, color: roadDrawMode === mode.id && tool === "road" ? COLORS.accent : COLORS.textMuted, borderRadius: 5, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 16 }}>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>

                {sectionTitle("Road Types")}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {ROAD_TYPES.map((rt) => (
                    <button key={rt.id} onClick={() => { setSelectedRoadType(rt); switchTool("road"); }}
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

                {sectionTitle("Intersection Templates")}
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {([
                    { id: 't' as const, label: 'T-Junction', icon: '⊤' },
                    { id: '4way' as const, label: '4-Way', icon: '✛' },
                  ]).map((itype) => (
                    <button key={itype.id}
                      onClick={() => { setIntersectionType(itype.id); switchTool("intersection"); }}
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
              <span data-testid="object-count">{objects.length} objects</span>
              <span>Tool: {tool.toUpperCase()}{tool === "road" ? ` (${roadDrawMode})` : tool === "intersection" ? ` (${intersectionType})` : ""}</span>
              <span>{showGrid ? "Grid ON" : "Grid OFF"}</span>
              <span>{snapEnabled ? "Snap: segment" : "Snap OFF"}</span>
              {autosaveError
                ? <span style={{ color: COLORS.danger }} title={`Auto-save failed: ${autosaveError}`}>⚠ Save failed</span>
                : <span style={{ color: COLORS.success }} title="Auto-saved to browser storage">● Auto-saved</span>
              }
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
                      {obj.type === "road" ? "━" : obj.type === "polyline_road" ? "⌇" : obj.type === "curve_road" ? "⌒" : obj.type === "cubic_bezier_road" ? "⌣" : obj.type === "sign" ? "⬡" : obj.type === "device" ? "▲" : obj.type === "zone" ? "▨" : obj.type === "arrow" ? "→" : obj.type === "text" ? "T" : obj.type === "taper" ? "⋈" : "📏"}
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
