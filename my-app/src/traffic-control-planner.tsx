import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Group, Shape, Image as KonvaImage } from "react-konva";
import type Konva from 'konva';
import type { Context as KonvaContext } from 'konva/lib/Context';
import type React from 'react';
import type {
  CanvasObject, StraightRoadObject, PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject,
  SignObject, DeviceObject, ZoneObject, ArrowObject, TextObject, MeasureObject, TaperObject, LaneMaskObject, CrosswalkObject,
  SignData, DeviceData, RoadType, DrawStart, PanStart,
  MapCenter, PlanMeta, Point, ToolDef,
  GeocodeResult, SignShape,
} from './types';
import { uid, dist, angleBetween, geoRoadWidthPx, sampleBezier, sampleCubicBezier, formatSearchPrimary, geocodeAddress, cloneObject } from './utils';
import { savePlanToCloud } from './planStorage';
import PlanDashboard from './PlanDashboard';
import TemplatePicker from './TemplatePicker';
import ExportPreviewModal from './ExportPreviewModal';
import { runQCChecks, type QCIssue } from './qcRules';
import { track } from './analytics';
import { LaneMaskShape, CrosswalkShape, TurnLaneShape } from './shapes/TrafficControlShapes';
import {
  DEVICES,
  ROAD_TYPES,
  SIGN_CATEGORIES,
  SIGN_SHAPES,
  TOOLS,
  TOOLS_REQUIRING_MAP,
} from './features/tcp/tcpCatalog';
import { COLORS, GRID_SIZE, MIN_ZOOM, MAX_ZOOM } from './features/tcp/constants';
import { normalizeForSearch, AUTOSAVE_KEY, readAutosave } from './features/tcp/planUtils';
import { sectionTitle, panelBtnStyle } from './features/tcp/panelHelpers';
import { drawSign } from './shapes/drawSign';
import { HelpModal } from './components/tcp/panels/HelpModal';
import { ManifestPanel } from './components/tcp/panels/ManifestPanel';
import { QCPanel, getQCBadgeColor } from './components/tcp/panels/QCPanel';
import { PropertyPanel } from './components/tcp/panels/PropertyPanel';
import { MiniMap } from './components/tcp/canvas/MiniMap';
import { LegendBox, NorthArrow } from './components/tcp/canvas/LegendBox';
import { useHistory } from './hooks/useHistory';
import { useAutosave } from './hooks/useAutosave';
import { useMapTiles } from './hooks/useMapTiles';
import { useCanvasEvents } from './hooks/useCanvasEvents';

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
  const { x1, y1, x2, y2, width, lanes, roadType, shoulderWidth = 0, sidewalkWidth = 0, sidewalkSide } = obj;
  const angle = angleBetween(x1, y1, x2, y2);
  const perpAngle = angle + Math.PI / 2;
  const hw = width / 2;
  const cos = Math.cos(perpAngle), sin = Math.sin(perpAngle);

  // Perpendicular unit vector (nx, ny) for offset lines
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;

  const showLeft  = sidewalkSide === 'both' || sidewalkSide === 'left';
  const showRight = sidewalkSide === 'both' || sidewalkSide === 'right';

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

  // Shoulder lines (rendered behind road body)
  const shoulderLines = shoulderWidth > 0 ? [
    <Line key="sl" points={[
      x1 + nx * (hw + shoulderWidth / 2), y1 + ny * (hw + shoulderWidth / 2),
      x2 + nx * (hw + shoulderWidth / 2), y2 + ny * (hw + shoulderWidth / 2),
    ]} stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth} listening={false} />,
    <Line key="sr" points={[
      x1 - nx * (hw + shoulderWidth / 2), y1 - ny * (hw + shoulderWidth / 2),
      x2 - nx * (hw + shoulderWidth / 2), y2 - ny * (hw + shoulderWidth / 2),
    ]} stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth} listening={false} />,
  ] : [];

  // Sidewalk lines (rendered behind road body, outside shoulder if present)
  const swOff = hw + (shoulderWidth > 0 ? shoulderWidth : 0) + (sidewalkWidth > 0 ? sidewalkWidth / 2 : 0);
  const sidewalkLines: React.ReactElement[] = [];
  if (sidewalkWidth > 0 && sidewalkSide) {
    if (showLeft) {
      sidewalkLines.push(
        <Line key="swl-fill" points={[
          x1 + nx * swOff, y1 + ny * swOff,
          x2 + nx * swOff, y2 + ny * swOff,
        ]} stroke="rgba(200,195,185,0.6)" strokeWidth={sidewalkWidth} listening={false} />,
        <Line key="swl-edge" points={[
          x1 + nx * (swOff + sidewalkWidth / 2), y1 + ny * (swOff + sidewalkWidth / 2),
          x2 + nx * (swOff + sidewalkWidth / 2), y2 + ny * (swOff + sidewalkWidth / 2),
        ]} stroke="rgba(160,155,145,0.8)" strokeWidth={1} listening={false} />,
      );
    }
    if (showRight) {
      sidewalkLines.push(
        <Line key="swr-fill" points={[
          x1 - nx * swOff, y1 - ny * swOff,
          x2 - nx * swOff, y2 - ny * swOff,
        ]} stroke="rgba(200,195,185,0.6)" strokeWidth={sidewalkWidth} listening={false} />,
        <Line key="swr-edge" points={[
          x1 - nx * (swOff + sidewalkWidth / 2), y1 - ny * (swOff + sidewalkWidth / 2),
          x2 - nx * (swOff + sidewalkWidth / 2), y2 - ny * (swOff + sidewalkWidth / 2),
        ]} stroke="rgba(160,155,145,0.8)" strokeWidth={1} listening={false} />,
      );
    }
  }

  return (
    <Group listening={false}>
      {/* Shoulders and sidewalks rendered first (behind road body) */}
      {sidewalkLines}
      {shoulderLines}
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
  const s = 18 * sc;
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
    case "lane_mask":    return <LaneMaskShape obj={obj} isSelected={isSelected} />;
    case "crosswalk":    return <CrosswalkShape obj={obj} isSelected={isSelected} />;
    case "turn_lane":    return <TurnLaneShape obj={obj} isSelected={isSelected} />;
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

  // Lane mask preview
  if (drawStart && tool === "lane_mask") {
    const previewMask: LaneMaskObject = {
      id: "__preview__",
      type: "lane_mask",
      x1: drawStart.x, y1: drawStart.y,
      x2: cursorPos.x, y2: cursorPos.y,
      laneWidth: 20,
      color: "rgba(239,68,68,0.5)",
      style: "hatch",
    };
    elements.push(<LaneMaskShape key="lane-mask-preview" obj={previewMask} isSelected={false} />);
  }

  // Crosswalk preview
  if (drawStart && tool === "crosswalk") {
    const previewCW: CrosswalkObject = {
      id: "__preview__",
      type: "crosswalk",
      x1: drawStart.x, y1: drawStart.y,
      x2: cursorPos.x, y2: cursorPos.y,
      depth: 24,
      stripeCount: 6,
      stripeColor: "#ffffff",
    };
    elements.push(<CrosswalkShape key="crosswalk-preview" obj={previewCW} isSelected={false} />);
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

// HelpModal → src/components/tcp/panels/HelpModal.tsx

// ─── SIGN EDITOR PANEL ───────────────────────────────────────────────────────

interface SignEditorPanelProps { onUseSign: () => void; onSaveToLibrary: (signData: SignData) => void; onSignChange: (signData: SignData) => void; }
function SignEditorPanel({ onUseSign, onSaveToLibrary, onSignChange }: SignEditorPanelProps) {
  const [shape, setShape] = useState<SignShape>("diamond");
  const [text, setText] = useState("CUSTOM");
  const [bgColor, setBgColor] = useState("#f97316");
  const [textColor, setTextColor] = useState("#111111");
  const previewRef = useRef<HTMLCanvasElement>(null);

  const signData = useMemo(() => ({
    // Derive id from configuration so legend/analytics can distinguish different editor signs.
    id: `custom_${shape}_${(text || " ").trim().toLowerCase().replace(/\s+/g, "_")}`,
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
    drawSign(ctx, { x: 50, y: 50, signData, rotation: 0, scale: 2.2 }, false);
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
          onClick={onUseSign}
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

// SignIconSvg, LegendBox, NorthArrow → src/components/tcp/canvas/LegendBox.tsx
// ManifestPanel → src/components/tcp/panels/ManifestPanel.tsx

// QCPanel, getQCBadgeColor → src/components/tcp/panels/QCPanel.tsx
// PropertyPanel → src/components/tcp/panels/PropertyPanel.tsx

// MiniMap → src/components/tcp/canvas/MiniMap.tsx

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
  const { objects, setObjects, pushHistory, undo, redo, resetHistory } = useHistory(initialAutosave?.canvasState?.objects ?? []);
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
  const [planTitle, setPlanTitle] = useState<string>(() => initialAutosave?.name ?? "Untitled Traffic Control Plan");
  const [planId, setPlanId] = useState<string>(() => initialAutosave?.id ?? uid());
  const [planCreatedAt, setPlanCreatedAt] = useState<string>(() => initialAutosave?.createdAt ?? new Date().toISOString());
  const [planMeta, setPlanMeta] = useState<PlanMeta>(() => initialAutosave?.metadata ?? { projectNumber: "", client: "", location: "", notes: "" });
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

  // Map tiles — computed and loaded by useMapTiles hook
  const { mapTiles, mapTileCacheRef } = useMapTiles(mapCenter, canvasSize);

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

  // Autosave — delegates to useAutosave hook
  const { autosaveError } = useAutosave({ objects, planId, planTitle, planCreatedAt, planMeta, zoom, offset, mapCenter, userId: userId ?? null });

  // Passive wheel listener to prevent page scroll
  useEffect(() => {
    const el = stageRef.current?.container();
    if (!el) return;
    const h = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

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

  // Mouse handlers + toWorld/trySnap/hitTest — managed by useCanvasEvents hook
  const { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = useCanvasEvents({
    tool, roadDrawMode, intersectionType, snapEnabled,
    objects, selected, zoom, offset, mapCenter,
    selectedSign, selectedDevice, selectedRoadType,
    polyPoints, curvePoints, cubicPoints,
    drawStart, isPanning, panStart,
    stageRef, lastClickTimeRef, lastClickPosRef,
    setObjects, setSelected, setZoom, setOffset, setMapCenter,
    setIsPanning, setPanStart, setDrawStart,
    setPolyPoints, setCurvePoints, setCubicPoints,
    setSnapIndicator, setCursorPos, pushHistory,
  });



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
    resetHistory(newObjects);
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
