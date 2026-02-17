import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── CONSTANTS & DATA ────────────────────────────────────────────────────────
const GRID_SIZE = 20;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const SNAP_RADIUS = 14; // screen-pixels for endpoint snap

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

const SIGN_SHAPES = [
  { id: "diamond",  label: "Diamond",   preview: "◆" },
  { id: "rect",     label: "Rectangle", preview: "▬" },
  { id: "octagon",  label: "Octagon",   preview: "⬡" },
  { id: "circle",   label: "Circle",    preview: "●" },
  { id: "triangle", label: "Triangle",  preview: "▲" },
  { id: "shield",   label: "Shield",    preview: "⊲" },
];

const SIGN_CATEGORIES = {
  regulatory: {
    label: "Regulatory",
    color: "#ef4444",
    signs: [
      { id: "stop",       label: "STOP",         shape: "octagon", color: "#ef4444", textColor: "#fff" },
      { id: "yield",      label: "YIELD",        shape: "triangle", color: "#ef4444", textColor: "#fff" },
      { id: "speed25",    label: "25",           shape: "rect",    color: "#fff", textColor: "#111", border: "#111" },
      { id: "speed35",    label: "35",           shape: "rect",    color: "#fff", textColor: "#111", border: "#111" },
      { id: "speed45",    label: "45",           shape: "rect",    color: "#fff", textColor: "#111", border: "#111" },
      { id: "noentry",    label: "⊘",            shape: "circle",  color: "#ef4444", textColor: "#fff" },
      { id: "oneway",     label: "ONE WAY →",    shape: "rect",    color: "#111", textColor: "#fff" },
      { id: "donotenter", label: "DO NOT ENTER", shape: "rect",    color: "#ef4444", textColor: "#fff" },
    ],
  },
  warning: {
    label: "Warning",
    color: "#f59e0b",
    signs: [
      { id: "roadwork",   label: "⚠ ROAD WORK", shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "flagahead",  label: "FLAGGER",      shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "merge",      label: "MERGE",        shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "curve",      label: "↺ CURVE",      shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "narrow",     label: "NARROW",       shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "bump",       label: "BUMP",         shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "pedestrian", label: "🚶",           shape: "diamond", color: "#f97316", textColor: "#111" },
      { id: "signal",     label: "🚦",           shape: "diamond", color: "#f97316", textColor: "#111" },
    ],
  },
  temporary: {
    label: "Temp Traffic Control",
    color: "#f97316",
    signs: [
      { id: "roadclosed",  label: "ROAD CLOSED",   shape: "rect", color: "#f97316", textColor: "#111" },
      { id: "detour",      label: "DETOUR →",      shape: "rect", color: "#f97316", textColor: "#111" },
      { id: "laneclosed",  label: "LANE CLOSED",   shape: "rect", color: "#f97316", textColor: "#111" },
      { id: "endwork",     label: "END ROAD WORK", shape: "rect", color: "#f97316", textColor: "#111" },
      { id: "slowtraffic", label: "SLOW TRAFFIC",  shape: "rect", color: "#f97316", textColor: "#111" },
      { id: "workzone",    label: "WORK ZONE",     shape: "rect", color: "#f97316", textColor: "#111" },
    ],
  },
  guide: {
    label: "Guide & Info",
    color: "#22c55e",
    signs: [
      { id: "parking",   label: "P",    shape: "rect",   color: "#3b82f6", textColor: "#fff" },
      { id: "hospital",  label: "H",    shape: "rect",   color: "#3b82f6", textColor: "#fff" },
      { id: "info",      label: "i",    shape: "rect",   color: "#3b82f6", textColor: "#fff" },
      { id: "interstate",label: "I-95", shape: "shield", color: "#3b82f6", textColor: "#fff" },
    ],
  },
};

const DEVICES = [
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

// realWidth = diagram-scale meters (≈3× real-world so roads are wide enough to work with on screen)
const ROAD_TYPES = [
  { id: "2lane",   label: "2-Lane Road",     lanes: 2, width: 80,  realWidth: 22 },
  { id: "4lane",   label: "4-Lane Road",     lanes: 4, width: 150, realWidth: 44 },
  { id: "6lane",   label: "6-Lane Divided",  lanes: 6, width: 220, realWidth: 66 },
  { id: "highway", label: "Highway",         lanes: 4, width: 180, realWidth: 58 },
];

// Compute road pixel width from its real-world diagram width and the map's geographic scale.
// Falls back to the stored pixel width if no map is loaded.
function geoRoadWidthPx(road, mapCenter) {
  if (!mapCenter || !road.realWidth) return road.width;
  const metersPerPixel =
    (40075016.686 * Math.cos(mapCenter.lat * Math.PI / 180)) /
    (Math.pow(2, mapCenter.zoom) * 256);
  return Math.max(10, road.realWidth / metersPerPixel);
}

const TOOLS = [
  { id: "select",  label: "Select",    icon: "↖", shortcut: "V" },
  { id: "pan",     label: "Pan",       icon: "✋", shortcut: "H" },
  { id: "road",    label: "Road",      icon: "━", shortcut: "R" },
  { id: "sign",    label: "Sign",      icon: "⬡", shortcut: "S" },
  { id: "device",  label: "Device",    icon: "▲", shortcut: "D" },
  { id: "zone",    label: "Work Zone", icon: "▨", shortcut: "Z" },
  { id: "text",    label: "Text",      icon: "T", shortcut: "T" },
  { id: "measure", label: "Measure",   icon: "📏", shortcut: "M" },
  { id: "arrow",   label: "Arrow",     icon: "→", shortcut: "A" },
  { id: "erase",   label: "Erase",     icon: "✕", shortcut: "X" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const dist = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
const angleBetween = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

// Moved to module level so SignEditorPanel can use them
const sectionTitle = (text) => (
  <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginTop: 12, fontFamily: "'JetBrains Mono', monospace" }}>
    {text}
  </div>
);

const panelBtnStyle = (active) => ({
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

// Endpoint snap: returns world-snapped coord + snapped flag
function snapToEndpoint(wx, wy, objects, thresholdScreenPx, zoom) {
  const t = thresholdScreenPx / zoom;
  for (const obj of objects) {
    if (obj.type === "road") {
      for (const ep of [{ x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }]) {
        if (dist(wx, wy, ep.x, ep.y) < t) return { x: ep.x, y: ep.y, snapped: true };
      }
    }
    if ((obj.type === "polyline_road" || obj.type === "curve_road") && obj.points?.length) {
      const eps = [obj.points[0], obj.points[obj.points.length - 1]];
      for (const ep of eps) {
        if (dist(wx, wy, ep.x, ep.y) < t) return { x: ep.x, y: ep.y, snapped: true };
      }
    }
  }
  return { x: wx, y: wy, snapped: false };
}

// Build an offset polyline (used for road ribbon rendering)
// Sample a quadratic Bezier into n+1 evenly-spaced-t points
function sampleBezier(p0, p1, p2, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    pts.push({ x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x, y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y });
  }
  return pts;
}

// Distance from point to segment (used by hitTest for poly/curve roads)
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

function distToPolyline(px, py, points) {
  let minD = Infinity;
  for (let i = 0; i < points.length - 1; i++)
    minD = Math.min(minD, distToSegment(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
  return minD;
}

async function geocodeAddress(query) {
  try {
    const response = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&maxLocations=5`
    );
    if (!response.ok) return [];
    const data = await response.json();
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    return candidates.map((c) => ({
      lat: String(c?.location?.y ?? ""),
      lon: String(c?.location?.x ?? ""),
      display_name: c?.address || "",
      address: { road: c?.address || "" },
    }));
  } catch { return []; }
}

function formatSearchPrimary(result) {
  const address = result?.address;
  if (address) {
    const street = [address.house_number, address.road || address.pedestrian || address.footway || address.cycleway].filter(Boolean).join(" ");
    const locality = address.city || address.town || address.village || address.hamlet || address.county;
    const region = address.state || address.state_district;
    const lr = [locality, region].filter(Boolean).join(", ");
    if (street && lr) return `${street}, ${lr}`;
    if (street) return street;
  }
  return result?.display_name || "";
}

// ─── DRAW FUNCTIONS ───────────────────────────────────────────────────────────

function drawRoadSegment(ctx, road, zoom) {
  const { x1, y1, x2, y2, width, lanes, type } = road;
  const angle = angleBetween(x1, y1, x2, y2);
  const perpAngle = angle + Math.PI / 2;
  const hw = width / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(perpAngle) * hw, y1 + Math.sin(perpAngle) * hw);
  ctx.lineTo(x2 + Math.cos(perpAngle) * hw, y2 + Math.sin(perpAngle) * hw);
  ctx.lineTo(x2 - Math.cos(perpAngle) * hw, y2 - Math.sin(perpAngle) * hw);
  ctx.lineTo(x1 - Math.cos(perpAngle) * hw, y1 - Math.sin(perpAngle) * hw);
  ctx.closePath();
  ctx.fillStyle = COLORS.road;
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = COLORS.roadLineWhite;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(perpAngle) * hw, y1 + Math.sin(perpAngle) * hw);
  ctx.lineTo(x2 + Math.cos(perpAngle) * hw, y2 + Math.sin(perpAngle) * hw);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 - Math.cos(perpAngle) * hw, y1 - Math.sin(perpAngle) * hw);
  ctx.lineTo(x2 - Math.cos(perpAngle) * hw, y2 - Math.sin(perpAngle) * hw);
  ctx.stroke();

  const laneWidth = width / lanes;
  for (let i = 1; i < lanes; i++) {
    const offset = -hw + i * laneWidth;
    const lx1 = x1 + Math.cos(perpAngle) * offset, ly1 = y1 + Math.sin(perpAngle) * offset;
    const lx2 = x2 + Math.cos(perpAngle) * offset, ly2 = y2 + Math.sin(perpAngle) * offset;
    if (i === lanes / 2 && type !== "2lane") {
      ctx.strokeStyle = COLORS.roadLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      const off2 = 3;
      ctx.beginPath();
      ctx.moveTo(lx1 + Math.cos(perpAngle) * off2, ly1 + Math.sin(perpAngle) * off2);
      ctx.lineTo(lx2 + Math.cos(perpAngle) * off2, ly2 + Math.sin(perpAngle) * off2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx1 - Math.cos(perpAngle) * off2, ly1 - Math.sin(perpAngle) * off2);
      ctx.lineTo(lx2 - Math.cos(perpAngle) * off2, ly2 - Math.sin(perpAngle) * off2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = COLORS.laneMarking;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 18]);
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPolylineRoad(ctx, road, isSelected) {
  const { points, width, lanes, roadType } = road;
  if (!points || points.length < 2) return;
  const hw = width / 2;

  // Filter zero-length consecutive duplicates
  const pts = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || dist(points[i].x, points[i].y, points[i - 1].x, points[i - 1].y) > 0.5)
      pts.push(points[i]);
  }
  if (pts.length < 2) return;

  // Use canvas native stroke for correct joins — overdraw technique for edges
  const tracePath = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };

  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  // Dark border
  ctx.strokeStyle = "#444";
  ctx.lineWidth = width + 4;
  tracePath(); ctx.stroke();

  // White edge strip (full width)
  ctx.strokeStyle = COLORS.roadLineWhite;
  ctx.lineWidth = width;
  tracePath(); ctx.stroke();

  // Road surface cuts back center, leaving 2px white on each side
  ctx.strokeStyle = COLORS.road;
  ctx.lineWidth = width - 4;
  tracePath(); ctx.stroke();

  // Lane markings — computed per segment for accurate perpendicular offsets
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
        ctx.strokeStyle = COLORS.roadLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        for (const d of [-2, 2]) {
          ctx.beginPath();
          ctx.moveTo(x1 + cx * (off + d), y1 + cy * (off + d));
          ctx.lineTo(x2 + cx * (off + d), y2 + cy * (off + d));
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = COLORS.laneMarking;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([12, 18]);
        ctx.beginPath();
        ctx.moveTo(x1 + cx * off, y1 + cy * off);
        ctx.lineTo(x2 + cx * off, y2 + cy * off);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);

  if (isSelected) {
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    tracePath(); ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.selected;
      ctx.fill();
    });
  }
  ctx.restore();
}

function drawCurveRoad(ctx, road, isSelected) {
  const { points, width, lanes, roadType } = road;
  if (!points || points.length < 3) return;
  const [p0, p1, p2] = points;
  const hw = width / 2;

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
  };

  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  // Dark border
  ctx.strokeStyle = "#444"; ctx.lineWidth = width + 4;
  tracePath(); ctx.stroke();
  // White edge strip
  ctx.strokeStyle = COLORS.roadLineWhite; ctx.lineWidth = width;
  tracePath(); ctx.stroke();
  // Road surface (leaves 2px white edges)
  ctx.strokeStyle = COLORS.road; ctx.lineWidth = width - 4;
  tracePath(); ctx.stroke();

  // Lane markings using sampled spine
  const spine = sampleBezier(p0, p1, p2, 32);
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
        ctx.strokeStyle = COLORS.roadLine; ctx.lineWidth = 2; ctx.setLineDash([]);
        for (const d of [-2, 2]) {
          ctx.beginPath();
          ctx.moveTo(x1 + cx * (off + d), y1 + cy * (off + d));
          ctx.lineTo(x2 + cx * (off + d), y2 + cy * (off + d));
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = COLORS.laneMarking; ctx.lineWidth = 1.5; ctx.setLineDash([12, 18]);
        ctx.beginPath();
        ctx.moveTo(x1 + cx * off, y1 + cy * off);
        ctx.lineTo(x2 + cx * off, y2 + cy * off);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);

  if (isSelected) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Control handle
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.info;
    ctx.fill();
    ctx.strokeStyle = "rgba(59,130,246,0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawSign(ctx, sign, isSelected) {
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
  ctx.font = `bold ${Math.max(9, 11 * scale)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = signData.label.length > 8 ? signData.label.slice(0, 7) + "…" : signData.label;
  ctx.fillText(label, 0, shape === "triangle" ? 4 : 0);
  ctx.restore();
}

function drawDevice(ctx, device, isSelected) {
  const { x, y, deviceData, rotation = 0 } = device;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  if (isSelected) { ctx.shadowColor = COLORS.selected; ctx.shadowBlur = 12; }
  ctx.fillStyle = deviceData.color;
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(deviceData.icon, 0, 0);
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.fillText(deviceData.label, 0, 18);
  ctx.restore();
}

function drawWorkZone(ctx, zone, isSelected) {
  const { x, y, w, h } = zone;
  ctx.save();
  ctx.fillStyle = "rgba(245,158,11,0.08)";
  ctx.strokeStyle = isSelected ? COLORS.selected : "rgba(245,158,11,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(245,158,11,0.12)";
  ctx.lineWidth = 1;
  for (let i = -Math.max(w, h); i < Math.max(w, h) * 2; i += 20) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
  }
  ctx.fillStyle = COLORS.accent;
  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("WORK ZONE", x + w / 2, y + h / 2);
  ctx.restore();
}

function drawArrow(ctx, arrow, isSelected) {
  const { x1, y1, x2, y2, color = "#fff" } = arrow;
  const angle = angleBetween(x1, y1, x2, y2);
  ctx.save();
  ctx.strokeStyle = isSelected ? COLORS.selected : color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const headLen = 14;
  ctx.fillStyle = isSelected ? COLORS.selected : color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTextLabel(ctx, item, isSelected) {
  ctx.save();
  ctx.fillStyle = isSelected ? COLORS.selected : (item.color || "#fff");
  ctx.font = `${item.bold ? "bold " : ""}${item.fontSize || 14}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(item.text, item.x, item.y);
  ctx.restore();
}

function drawMeasurement(ctx, m) {
  const d = dist(m.x1, m.y1, m.x2, m.y2);
  const ft = (d * 0.5).toFixed(1);
  const midX = (m.x1 + m.x2) / 2, midY = (m.y1 + m.y2) / 2;
  ctx.save();
  ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(m.x2, m.y2); ctx.stroke();
  ctx.setLineDash([]);
  [[m.x1, m.y1], [m.x2, m.y2]].forEach(([ex, ey]) => {
    ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#818cf8"; ctx.fill();
  });
  ctx.fillStyle = "#0f1117"; ctx.fillRect(midX - 28, midY - 10, 56, 20);
  ctx.fillStyle = "#818cf8"; ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 1;
  ctx.strokeRect(midX - 28, midY - 10, 56, 20);
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${ft} ft`, midX, midY);
  ctx.restore();
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function ToolButton({ tool, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
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

function SignEditorPanel({ onUseSign }) {
  const [shape, setShape] = useState("diamond");
  const [text, setText] = useState("CUSTOM");
  const [bgColor, setBgColor] = useState("#f97316");
  const [textColor, setTextColor] = useState("#111111");
  const previewRef = useRef(null);

  const signData = useMemo(() => ({
    id: "custom_preview",
    label: text || " ",
    shape,
    color: bgColor,
    textColor,
    border: "#333",
  }), [shape, text, bgColor, textColor]);

  useEffect(() => {
    const cvs = previewRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
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
            onClick={() => setShape(s.id)}
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

      <button
        onClick={() => onUseSign({ ...signData, id: "custom_" + uid() })}
        style={{
          padding: "8px 0", background: COLORS.accentDim,
          border: `1px solid ${COLORS.accent}`, borderRadius: 6,
          color: COLORS.accent, cursor: "pointer", fontSize: 11,
          fontFamily: "inherit", fontWeight: 600, letterSpacing: 0.5,
        }}
      >
        ✓ Place This Sign
      </button>
    </div>
  );
}

// ─── PROPERTY PANEL ──────────────────────────────────────────────────────────

function PropertyPanel({ selected, objects, onUpdate, onDelete }) {
  if (!selected) {
    return (
      <div style={{ padding: 16, color: COLORS.textDim, fontSize: 12, textAlign: "center" }}>
        Select an object to edit its properties
      </div>
    );
  }
  const obj = objects.find((o) => o.id === selected);
  if (!obj) return null;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {obj.type === "polyline_road" ? "Polyline Road" : obj.type === "curve_road" ? "Curve Road" : obj.type} Properties
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

      {(obj.type === "polyline_road" || obj.type === "curve_road") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {obj.type === "polyline_road"
              ? `Polyline — ${obj.points.length} points`
              : "Quadratic Bézier curve"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {obj.roadType} · {obj.lanes} lanes · {obj.width}px wide
          </div>
        </div>
      )}

      <button
        onClick={() => onDelete(obj.id)}
        style={{
          marginTop: 12, width: "100%", padding: "6px 0",
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

// ─── MINI MAP ─────────────────────────────────────────────────────────────────

function MiniMap({ objects, canvasSize, zoom, offset }) {
  const ref = useRef(null);
  const mmW = 160, mmH = 100;

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, mmW, mmH);

    const worldW = 4000, worldH = 3000;
    const s = Math.min(mmW / worldW, mmH / worldH);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, mmW, mmH);

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
          i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
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
      } else if (obj.x !== undefined) {
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect((obj.x + 2000) * s - 1, (obj.y + 1500) * s - 1, 3, 3);
      }
    });

    const vx = (-offset.x / zoom + 2000) * s;
    const vy = (-offset.y / zoom + 1500) * s;
    const vw = (canvasSize.w / zoom) * s;
    const vh = (canvasSize.h / zoom) * s;
    ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [objects, canvasSize, zoom, offset]);

  return (
    <canvas ref={ref} width={mmW} height={mmH}
      style={{ borderRadius: 6, border: `1px solid ${COLORS.panelBorder}` }} />
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TrafficControlPlanner() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Core state
  const [tool, setTool] = useState("select");
  const [objects, setObjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [drawStart, setDrawStart] = useState(null);
  const [selectedSign, setSelectedSign] = useState(SIGN_CATEGORIES.regulatory.signs[0]);
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);
  const [selectedRoadType, setSelectedRoadType] = useState(ROAD_TYPES[0]);
  const [signCategory, setSignCategory] = useState("regulatory");
  const [leftPanel, setLeftPanel] = useState("tools");
  const [rightPanel, setRightPanel] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [planTitle, setPlanTitle] = useState("Untitled Traffic Control Plan");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [mapCenter, setMapCenter] = useState(null);
  const [mapRenderTick, setMapRenderTick] = useState(0);
  const mapTileCacheRef = useRef({});

  // New state for road drawing modes, polyline/curve construction, snap, sign editor
  const [roadDrawMode, setRoadDrawMode] = useState("straight"); // "straight" | "poly" | "curve"
  const [polyPoints, setPolyPoints] = useState([]);   // in-progress polyline points
  const [curvePoints, setCurvePoints] = useState([]); // in-progress curve points (0-2)
  const [snapIndicator, setSnapIndicator] = useState(null); // { x, y } world-coords or null
  const [signSubTab, setSignSubTab] = useState("library"); // "library" | "editor"

  const lastClickTimeRef = useRef(0);
  const lastClickPosRef = useRef(null);

  // Map tiles
  const mapTiles = useMemo(() => {
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
    const tiles = [];
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
      const entry = { image, loaded: false };
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

  // Clear poly/curve in-progress when tool changes
  useEffect(() => {
    if (tool !== "road") { setPolyPoints([]); setCurvePoints([]); }
  }, [tool]);
  useEffect(() => {
    setPolyPoints([]); setCurvePoints([]);
  }, [roadDrawMode]);

  // History
  const pushHistory = useCallback((newObjects) => {
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

  // switchTool: sets tool AND clears in-progress road drawing
  const switchTool = useCallback((newTool) => {
    setTool(newTool);
    setPolyPoints([]);
    setCurvePoints([]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const key = e.key.toUpperCase();

      if (e.metaKey || e.ctrlKey) {
        if (key === "Z" && e.shiftKey) { e.preventDefault(); redo(); return; }
        if (key === "Z") { e.preventDefault(); undo(); return; }
      }

      if (key === "ESCAPE") {
        setPolyPoints([]); setCurvePoints([]); setDrawStart(null); return;
      }

      if (key === "ENTER") {
        if (tool === "road" && roadDrawMode === "poly" && polyPoints.length >= 2) {
          const newRoad = { id: uid(), type: "polyline_road", points: [...polyPoints], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setPolyPoints([]);
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
  }, [selected, objects, undo, redo, pushHistory, tool, roadDrawMode, polyPoints, selectedRoadType, switchTool]);

  // toWorld: returns raw world coords (no grid snap — freeform)
  const toWorld = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offset.x) / zoom,
      y: (clientY - rect.top - offset.y) / zoom,
    };
  }, [offset, zoom]);

  // Conditionally apply endpoint snap
  const trySnap = useCallback((x, y) => {
    if (!snapEnabled) return { x, y, snapped: false };
    return snapToEndpoint(x, y, objects, SNAP_RADIUS, zoom);
  }, [snapEnabled, objects, zoom]);

  // hitTest
  const hitTest = useCallback((wx, wy) => {
    const effectiveHalfWidth = (o) => geoRoadWidthPx(o, mapCenter) / 2 + 6;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.type === "sign" || o.type === "device" || o.type === "text") {
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
    }
    return null;
  }, [objects, mapCenter]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const raw = toWorld(e.clientX, e.clientY);
    const { x, y, snapped } = trySnap(raw.x, raw.y);
    setCursorPos(raw);
    setSnapIndicator(snapped ? { x, y } : null);

    if (tool === "pan" || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    if (tool === "select") {
      const hit = hitTest(raw.x, raw.y);
      setSelected(hit ? hit.id : null);
      if (hit) {
        setDrawStart({
          x: raw.x, y: raw.y,
          ox: hit.x !== undefined ? hit.x : (hit.x1 ?? 0),
          oy: hit.y !== undefined ? hit.y : (hit.y1 ?? 0),
          id: hit.id,
          origPoints: hit.points ? hit.points.map((p) => ({ ...p })) : null,
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
      const newSign = { id: uid(), type: "sign", x: raw.x, y: raw.y, signData: selectedSign, rotation: 0, scale: 1 };
      const newObjs = [...objects, newSign];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newSign.id);
      return;
    }

    if (tool === "device") {
      const newDev = { id: uid(), type: "device", x: raw.x, y: raw.y, deviceData: selectedDevice, rotation: 0 };
      const newObjs = [...objects, newDev];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newDev.id);
      return;
    }

    if (tool === "text") {
      const textVal = prompt("Enter text label:");
      if (textVal) {
        const newText = { id: uid(), type: "text", x: raw.x, y: raw.y, text: textVal, fontSize: 14, bold: false, color: "#ffffff" };
        const newObjs = [...objects, newText];
        setObjects(newObjs); pushHistory(newObjs); setSelected(newText.id);
      }
      return;
    }

    // Road tool — dispatch by draw mode
    if (tool === "road") {
      if (roadDrawMode === "straight") {
        setDrawStart({ x, y });
        return;
      }

      if (roadDrawMode === "poly") {
        const now = Date.now();
        const last = lastClickPosRef.current;
        const isDouble = (now - lastClickTimeRef.current < 350) && last && dist(x, y, last.x, last.y) < 15 / zoom;
        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x, y };

        if (isDouble && polyPoints.length >= 2) {
          // Commit without adding the duplicate double-click point
          const newRoad = { id: uid(), type: "polyline_road", points: [...polyPoints], width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setPolyPoints([]);
        } else {
          setPolyPoints((prev) => [...prev, { x, y }]);
        }
        return;
      }

      if (roadDrawMode === "curve") {
        const newCurvePts = [...curvePoints, { x, y }];
        if (newCurvePts.length === 3) {
          const newRoad = { id: uid(), type: "curve_road", points: newCurvePts, width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
          const newObjs = [...objects, newRoad];
          setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id); setCurvePoints([]);
        } else {
          setCurvePoints(newCurvePts);
        }
        return;
      }
    }

    if (["zone", "arrow", "measure"].includes(tool)) {
      setDrawStart({ x: raw.x, y: raw.y });
    }
  }, [tool, roadDrawMode, toWorld, trySnap, hitTest, offset, objects, selectedSign, selectedDevice, selectedRoadType, polyPoints, curvePoints, pushHistory, zoom]);

  const handleMouseMove = useCallback((e) => {
    const raw = toWorld(e.clientX, e.clientY);
    setCursorPos(raw);

    // Update snap indicator when drawing roads
    if (tool === "road" && snapEnabled) {
      const { x, y, snapped } = snapToEndpoint(raw.x, raw.y, objects, SNAP_RADIUS, zoom);
      setSnapIndicator(snapped ? { x, y } : null);
    } else {
      setSnapIndicator(null);
    }

    if (isPanning && panStart) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (tool === "select" && drawStart && drawStart.id) {
      const dx = raw.x - drawStart.x, dy = raw.y - drawStart.y;
      setObjects((prev) => prev.map((o) => {
        if (o.id !== drawStart.id) return o;
        if ((o.type === "polyline_road" || o.type === "curve_road") && drawStart.origPoints) {
          return { ...o, points: drawStart.origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
        }
        if (o.x !== undefined && o.x1 === undefined) {
          return { ...o, x: drawStart.ox + dx, y: drawStart.oy + dy };
        }
        if (o.x1 !== undefined) {
          const sdx = o.x2 - o.x1, sdy = o.y2 - o.y1;
          return { ...o, x1: drawStart.ox + dx, y1: drawStart.oy + dy, x2: drawStart.ox + dx + sdx, y2: drawStart.oy + dy + sdy };
        }
        return o;
      }));
    }
  }, [isPanning, panStart, toWorld, tool, drawStart, snapEnabled, objects, zoom]);

  const handleMouseUp = useCallback((e) => {
    if (isPanning) { setIsPanning(false); setPanStart(null); return; }

    if (tool === "select" && drawStart && drawStart.id) {
      pushHistory(objects); setDrawStart(null); return;
    }

    // Straight road: commit on mouseUp
    if (drawStart && tool === "road" && roadDrawMode === "straight") {
      const raw = toWorld(e.clientX, e.clientY);
      const { x, y } = trySnap(raw.x, raw.y);
      const d = dist(drawStart.x, drawStart.y, x, y);
      if (d < 5) { setDrawStart(null); return; }
      const newRoad = { id: uid(), type: "road", x1: drawStart.x, y1: drawStart.y, x2: x, y2: y, width: selectedRoadType.width, realWidth: selectedRoadType.realWidth, lanes: selectedRoadType.lanes, roadType: selectedRoadType.id };
      const newObjs = [...objects, newRoad];
      setObjects(newObjs); pushHistory(newObjs); setSelected(newRoad.id);
      setDrawStart(null);
      return;
    }

    if (drawStart && ["zone", "arrow", "measure"].includes(tool)) {
      const { x, y } = toWorld(e.clientX, e.clientY);
      const d = dist(drawStart.x, drawStart.y, x, y);
      if (d < 5) { setDrawStart(null); return; }

      let newObj;
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

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    setZoom(newZoom);
    setOffset({ x: mx - ((mx - offset.x) / zoom) * newZoom, y: my - ((my - offset.y) / zoom) * newZoom });
  }, [zoom, offset]);

  // Canvas render
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    cvs.width = canvasSize.w * dpr;
    cvs.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    if (mapCenter) {
      ctx.fillStyle = COLORS.canvas; ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
      mapTiles.forEach((tile) => {
        const cached = mapTileCacheRef.current[tile.url];
        if (cached?.loaded) ctx.drawImage(cached.image, tile.x, tile.y, tile.size, tile.size);
      });
      ctx.fillStyle = "rgba(15,17,23,0.18)"; ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
    } else {
      ctx.fillStyle = COLORS.canvas; ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
    }

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Grid (visual only)
    if (showGrid) {
      const startX = Math.floor(-offset.x / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
      const startY = Math.floor(-offset.y / zoom / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
      const endX = startX + canvasSize.w / zoom + GRID_SIZE * 2;
      const endY = startY + canvasSize.h / zoom + GRID_SIZE * 2;
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.5;
      for (let gx = startX; gx < endX; gx += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(gx, startY); ctx.lineTo(gx, endY); ctx.stroke();
      }
      for (let gy = startY; gy < endY; gy += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(startX, gy); ctx.lineTo(endX, gy); ctx.stroke();
      }
    }

    // Draw objects
    objects.forEach((obj) => {
      const isSel = obj.id === selected;
      // Resolve geographic width (if map loaded and road has a real-world reference width)
      const robj = (obj.realWidth && mapCenter)
        ? { ...obj, width: geoRoadWidthPx(obj, mapCenter) }
        : obj;
      switch (obj.type) {
        case "road":
          drawRoadSegment(ctx, robj, zoom);
          if (isSel) {
            ctx.strokeStyle = COLORS.selected; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(obj.x1, obj.y1); ctx.lineTo(obj.x2, obj.y2); ctx.stroke();
            ctx.setLineDash([]);
          }
          break;
        case "polyline_road":
          drawPolylineRoad(ctx, robj, isSel);
          break;
        case "curve_road":
          drawCurveRoad(ctx, robj, isSel);
          break;
        case "sign":   drawSign(ctx, obj, isSel); break;
        case "device": drawDevice(ctx, obj, isSel); break;
        case "zone":   drawWorkZone(ctx, obj, isSel); break;
        case "arrow":  drawArrow(ctx, obj, isSel); break;
        case "text":   drawTextLabel(ctx, obj, isSel); break;
        case "measure":drawMeasurement(ctx, obj); break;
      }
    });

    // ── Drag previews ──
    const previewTarget = snapIndicator || cursorPos;

    // Straight road preview
    if (drawStart && tool === "road" && roadDrawMode === "straight") {
      ctx.strokeStyle = "rgba(245,158,11,0.5)";
      ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(previewTarget.x, previewTarget.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Zone / arrow / measure previews
    if (drawStart && ["zone", "arrow", "measure"].includes(tool)) {
      ctx.strokeStyle = "rgba(245,158,11,0.5)";
      ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      if (tool === "zone") {
        const zx = Math.min(drawStart.x, cursorPos.x), zy = Math.min(drawStart.y, cursorPos.y);
        ctx.strokeRect(zx, zy, Math.abs(cursorPos.x - drawStart.x), Math.abs(cursorPos.y - drawStart.y));
      } else {
        ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
        ctx.lineTo(cursorPos.x, cursorPos.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Polyline in-progress preview
    if (tool === "road" && roadDrawMode === "poly" && polyPoints.length > 0) {
      ctx.strokeStyle = "rgba(245,158,11,0.65)";
      ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      polyPoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.lineTo(previewTarget.x, previewTarget.y);
      ctx.stroke(); ctx.setLineDash([]);
      polyPoints.forEach((p, idx) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? COLORS.success : COLORS.accent; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
      });
    }

    // Curve in-progress preview
    if (tool === "road" && roadDrawMode === "curve" && curvePoints.length > 0) {
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(245,158,11,0.65)";
      ctx.beginPath();
      if (curvePoints.length === 1) {
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        ctx.lineTo(previewTarget.x, previewTarget.y);
        ctx.stroke();
      } else {
        // 2 points: show bezier preview with cursor as end
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        ctx.quadraticCurveTo(curvePoints[1].x, curvePoints[1].y, previewTarget.x, previewTarget.y);
        ctx.stroke();
        // Tangent helper lines
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
        ctx.lineTo(curvePoints[1].x, curvePoints[1].y);
        ctx.lineTo(previewTarget.x, previewTarget.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      curvePoints.forEach((p, idx) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? COLORS.success : COLORS.info; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
      });
    }

    // Snap indicator (endpoint snap crosshair)
    if (snapIndicator) {
      ctx.beginPath(); ctx.arc(snapIndicator.x, snapIndicator.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.success; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(snapIndicator.x, snapIndicator.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.success; ctx.fill();
    }

    ctx.restore();
  }, [objects, selected, zoom, offset, canvasSize, showGrid, tool, roadDrawMode, drawStart, cursorPos, polyPoints, curvePoints, snapIndicator, mapCenter, mapTiles, mapRenderTick]);

  // Object helpers
  const updateObject = (id, updates) => {
    const newObjs = objects.map((o) => (o.id === id ? { ...o, ...updates } : o));
    setObjects(newObjs); pushHistory(newObjs);
  };

  const deleteObject = (id) => {
    const newObjs = objects.filter((o) => o.id !== id);
    setObjects(newObjs); pushHistory(newObjs); setSelected(null);
  };

  const clearAll = () => {
    if (confirm("Clear all objects?")) { setObjects([]); pushHistory([]); setSelected(null); }
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

  const selectAddressResult = (result) => {
    setSearchQuery(formatSearchPrimary(result));
    const lat = Number(result?.lat), lon = Number(result?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      setMapCenter({ lat, lon, zoom: 16 }); setOffset({ x: 0, y: 0 }); setZoom(1);
      setSearchStatus(`Centered on ${formatSearchPrimary(result)}`);
    } else { setSearchStatus("Selected result has no coordinates."); }
    setSearchOpen(false);
  };

  const isSearchError = searchStatus.startsWith("Address lookup failed") || searchStatus.startsWith("No matches") || searchStatus.startsWith("Selected result");

  // ── Derived state for status bar hints ──
  const polyInProgress = tool === "road" && roadDrawMode === "poly" && polyPoints.length > 0;
  const curveInProgress = tool === "road" && roadDrawMode === "curve" && curvePoints.length > 0;

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: COLORS.bg, color: COLORS.text, fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", overflow: "hidden", userSelect: "none" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* ─── TOP BAR ─── */}
      <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel, flexShrink: 0, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20, color: COLORS.accent }}>◆</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, letterSpacing: 1 }}>TCP</span>
          </div>
          <div style={{ width: 1, height: 24, background: COLORS.panelBorder }} />
          <input
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            style={{ background: "transparent", border: "none", color: COLORS.text, fontSize: 13, fontWeight: 500, width: 280, padding: "4px 8px", borderRadius: 4, fontFamily: "inherit" }}
          />
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
          <button onClick={undo} style={panelBtnStyle(false)} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button onClick={redo} style={panelBtnStyle(false)} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
          <div style={{ width: 1, height: 20, background: COLORS.panelBorder }} />
          <button onClick={clearAll} style={{ ...panelBtnStyle(false), color: COLORS.danger, borderColor: "rgba(239,68,68,0.3)" }}>Clear All</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ─── LEFT PANEL ─── */}
        <div style={{ width: 260, background: COLORS.panel, borderRight: `1px solid ${COLORS.panelBorder}`, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
            {["tools", "signs", "devices", "roads"].map((tab) => (
              <button key={tab} onClick={() => setLeftPanel(tab)}
                style={{ flex: 1, padding: "8px 0", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, background: leftPanel === tab ? COLORS.accentDim : "transparent", color: leftPanel === tab ? COLORS.accent : COLORS.textDim, border: "none", borderBottom: leftPanel === tab ? `2px solid ${COLORS.accent}` : "2px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>

            {/* TOOLS TAB */}
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
                    <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} style={{ accentColor: COLORS.accent }} />
                    Snap to Endpoints
                  </label>
                </div>

                {sectionTitle("Zoom")}
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={zoomOut} style={panelBtnStyle(false)}>−</button>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: COLORS.text, lineHeight: "28px" }}>{(zoom * 100).toFixed(0)}%</div>
                  <button onClick={zoomIn} style={panelBtnStyle(false)}>+</button>
                  <button onClick={zoomFit} style={panelBtnStyle(false)}>Fit</button>
                </div>

                {sectionTitle("Objects")}
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{objects.length} objects on canvas</div>

                {sectionTitle("Mini Map")}
                <MiniMap objects={objects} canvasSize={canvasSize} zoom={zoom} offset={offset} />
              </>
            )}

            {/* SIGNS TAB */}
            {leftPanel === "signs" && (
              <>
                {/* Sign sub-tabs */}
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
                    <div style={{ marginTop: 12, padding: 8, background: "rgba(245,158,11,0.05)", borderRadius: 6, border: `1px solid rgba(245,158,11,0.1)` }}>
                      <div style={{ fontSize: 9, color: COLORS.accent }}>Select a sign then click on the canvas to place it.</div>
                    </div>
                  </>
                )}

                {signSubTab === "editor" && (
                  <SignEditorPanel
                    onUseSign={(signData) => {
                      setSelectedSign(signData);
                      switchTool("sign");
                      setSignSubTab("library");
                    }}
                  />
                )}
              </>
            )}

            {/* DEVICES TAB */}
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

            {/* ROADS TAB */}
            {leftPanel === "roads" && (
              <>
                {sectionTitle("Drawing Mode")}
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[
                    { id: "straight", label: "Straight", icon: "━" },
                    { id: "poly",     label: "Polyline", icon: "⌇" },
                    { id: "curve",    label: "Curve",    icon: "⌒" },
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

                <div style={{ marginTop: 12, padding: 8, background: "rgba(245,158,11,0.05)", borderRadius: 6, border: `1px solid rgba(245,158,11,0.1)` }}>
                  <div style={{ fontSize: 9, color: COLORS.accent }}>
                    {roadDrawMode === "straight" && "Click and drag to draw a straight road."}
                    {roadDrawMode === "poly" && "Click to add points. Double-click or Enter to finish. Esc to cancel."}
                    {roadDrawMode === "curve" && "Click: start → control point → end. Esc to cancel."}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── CANVAS ─── */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <canvas
            ref={canvasRef}
            style={{
              width: canvasSize.w, height: canvasSize.h,
              cursor: tool === "pan" || isPanning ? "grab" : tool === "erase" ? "crosshair" : tool === "select" ? "default" : "crosshair",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setIsPanning(false); setPanStart(null); setSnapIndicator(null); }}
            onWheel={handleWheel}
          />

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
                  Curve: {curvePoints.length === 1 ? "click control point" : "click end point"} · Esc cancel
                </span>
              )}
              <span>{objects.length} objects</span>
              <span>Tool: {tool.toUpperCase()}{tool === "road" ? ` (${roadDrawMode})` : ""}</span>
              <span>{showGrid ? "Grid ON" : "Grid OFF"}</span>
              <span>{snapEnabled ? "Snap: endpoint" : "Snap OFF"}</span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        {rightPanel && (
          <div style={{ width: 220, background: COLORS.panel, borderLeft: `1px solid ${COLORS.panelBorder}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.panelBorder}`, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: COLORS.textDim, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Properties
              <button onClick={() => setRightPanel(false)} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
            <PropertyPanel selected={selected} objects={objects} onUpdate={updateObject} onDelete={deleteObject} />

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
                      {obj.type === "road" ? "━" : obj.type === "polyline_road" ? "⌇" : obj.type === "curve_road" ? "⌒" : obj.type === "sign" ? "⬡" : obj.type === "device" ? "▲" : obj.type === "zone" ? "▨" : obj.type === "arrow" ? "→" : obj.type === "text" ? "T" : "📏"}
                    </span>
                    <span>
                      {obj.type === "sign" ? obj.signData.label :
                       obj.type === "device" ? obj.deviceData.label :
                       obj.type === "text" ? `"${obj.text.slice(0, 12)}"` :
                       obj.type === "road" ? `${obj.roadType} road` :
                       obj.type === "polyline_road" ? `poly (${obj.points.length}pts)` :
                       obj.type === "curve_road" ? "curve road" :
                       obj.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {!rightPanel && (
          <button onClick={() => setRightPanel(true)}
            style={{ position: "absolute", top: 60, right: 12, ...panelBtnStyle(false), background: COLORS.panel }}>
            ◀ Props
          </button>
        )}
      </div>
    </div>
  );
}
