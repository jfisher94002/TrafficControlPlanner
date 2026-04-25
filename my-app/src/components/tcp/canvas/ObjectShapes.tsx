import { Line, Rect, Circle, Text as KonvaText, Group, Shape } from 'react-konva';
import type { Context as KonvaContext } from 'konva/lib/Context';
import type React from 'react';
import type {
  CanvasObject, StraightRoadObject, PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject,
  SignObject, DeviceObject, ZoneObject, ArrowObject, TextObject, MeasureObject, TaperObject, Point,
  ArrowBoardMode,
} from '../../../types';
import { angleBetween, dist, sampleBezier, sampleCubicBezier, buildOffsetSpine } from '../../../utils';
import { COLORS, GRID_SIZE, TAPER_SCALE } from '../../../features/tcp/constants';
import { LaneMaskShape, CrosswalkShape, TurnLaneShape } from '../../../shapes/TrafficControlShapes';

export { TAPER_SCALE };

interface GridLinesProps { offset: Point; zoom: number; canvasSize: { w: number; h: number }; }
export function GridLines({ offset, zoom, canvasSize }: GridLinesProps) {
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
export function RoadSegment({ obj, isSelected }: RoadSegmentProps) {
  const { x1, y1, x2, y2, width, lanes, roadType, shoulderWidth = 0, sidewalkWidth = 0, sidewalkSide } = obj;
  const angle = angleBetween(x1, y1, x2, y2);
  const perpAngle = angle + Math.PI / 2;
  const hw = width / 2;
  const cos = Math.cos(perpAngle), sin = Math.sin(perpAngle);

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

  const { id } = obj;
  const shoulderLines = shoulderWidth > 0 ? [
    <Line key={`${id}-sl`} points={[
      x1 + nx * (hw + shoulderWidth / 2), y1 + ny * (hw + shoulderWidth / 2),
      x2 + nx * (hw + shoulderWidth / 2), y2 + ny * (hw + shoulderWidth / 2),
    ]} stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth} listening={false} />,
    <Line key={`${id}-sr`} points={[
      x1 - nx * (hw + shoulderWidth / 2), y1 - ny * (hw + shoulderWidth / 2),
      x2 - nx * (hw + shoulderWidth / 2), y2 - ny * (hw + shoulderWidth / 2),
    ]} stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth} listening={false} />,
  ] : [];

  const swOff = hw + (shoulderWidth > 0 ? shoulderWidth : 0) + (sidewalkWidth > 0 ? sidewalkWidth / 2 : 0);
  const sidewalkLines: React.ReactElement[] = [];
  if (sidewalkWidth > 0 && sidewalkSide) {
    if (showLeft) {
      sidewalkLines.push(
        <Line key={`${id}-swl-fill`} points={[
          x1 + nx * swOff, y1 + ny * swOff,
          x2 + nx * swOff, y2 + ny * swOff,
        ]} stroke="rgba(200,195,185,0.6)" strokeWidth={sidewalkWidth} listening={false} />,
        <Line key={`${id}-swl-edge`} points={[
          x1 + nx * (swOff + sidewalkWidth / 2), y1 + ny * (swOff + sidewalkWidth / 2),
          x2 + nx * (swOff + sidewalkWidth / 2), y2 + ny * (swOff + sidewalkWidth / 2),
        ]} stroke="rgba(160,155,145,0.8)" strokeWidth={1} listening={false} />,
      );
    }
    if (showRight) {
      sidewalkLines.push(
        <Line key={`${id}-swr-fill`} points={[
          x1 - nx * swOff, y1 - ny * swOff,
          x2 - nx * swOff, y2 - ny * swOff,
        ]} stroke="rgba(200,195,185,0.6)" strokeWidth={sidewalkWidth} listening={false} />,
        <Line key={`${id}-swr-edge`} points={[
          x1 - nx * (swOff + sidewalkWidth / 2), y1 - ny * (swOff + sidewalkWidth / 2),
          x2 - nx * (swOff + sidewalkWidth / 2), y2 - ny * (swOff + sidewalkWidth / 2),
        ]} stroke="rgba(160,155,145,0.8)" strokeWidth={1} listening={false} />,
      );
    }
  }

  const isBikeLane = roadType === 'bike_lane';
  const fillColor  = isBikeLane ? COLORS.bikeLane : COLORS.road;
  const edgeColor  = isBikeLane ? COLORS.bikeLaneStripe : COLORS.roadLineWhite;

  // Bike lane: dashed white center symbol stripe
  const bikeCenterLine = isBikeLane ? (
    <Line points={[x1, y1, x2, y2]} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dash={[8, 12]} listening={false} />
  ) : null;

  return (
    <Group listening={false}>
      {sidewalkLines}
      {shoulderLines}
      <Circle x={x1} y={y1} radius={hw + 1} fill="#555" listening={false} />
      <Circle x={x2} y={y2} radius={hw + 1} fill="#555" listening={false} />
      <Circle x={x1} y={y1} radius={hw - 1} fill={fillColor} listening={false} />
      <Circle x={x2} y={y2} radius={hw - 1} fill={fillColor} listening={false} />
      <Line points={roadPoly} closed fill={fillColor} stroke="#555" strokeWidth={2} />
      <Line points={[x1 + cos * hw, y1 + sin * hw, x2 + cos * hw, y2 + sin * hw]} stroke={edgeColor} strokeWidth={2} />
      <Line points={[x1 - cos * hw, y1 - sin * hw, x2 - cos * hw, y2 - sin * hw]} stroke={edgeColor} strokeWidth={2} />
      {laneMarkings}
      {bikeCenterLine}
      {isSelected && <Line points={[x1, y1, x2, y2]} stroke={COLORS.selected} strokeWidth={2} dash={[6, 4]} />}
    </Group>
  );
}

/**
 * Builds the shoulder and sidewalk Line elements for any curved road type.
 * Returns them in back-to-front order: sidewalk fills, sidewalk edges, shoulders.
 * Uses the same offsets and colors as StraightRoad.
 */
function buildShoulderSidewalkLines(
  id: string,
  spine: Point[],
  hw: number,
  shoulderWidth: number,
  sidewalkWidth: number,
  sidewalkSide?: 'left' | 'right' | 'both',
): React.ReactElement[] {
  const showLeft  = sidewalkSide === 'both' || sidewalkSide === 'left';
  const showRight = sidewalkSide === 'both' || sidewalkSide === 'right';
  const sidewalkLines: React.ReactElement[] = [];
  const shoulderLines: React.ReactElement[] = [];

  if (sidewalkWidth > 0 && sidewalkSide) {
    const swOff = hw + shoulderWidth + sidewalkWidth / 2;
    if (showLeft) {
      sidewalkLines.push(
        <Line key={`${id}-swl-fill`} points={buildOffsetSpine(spine, swOff)}
          stroke="rgba(200,195,185,0.6)" strokeWidth={sidewalkWidth} lineCap="round" lineJoin="round" listening={false} />,
        <Line key={`${id}-swl-edge`} points={buildOffsetSpine(spine, swOff + sidewalkWidth / 2)}
          stroke="rgba(160,155,145,0.8)" strokeWidth={1} lineCap="round" lineJoin="round" listening={false} />,
      );
    }
    if (showRight) {
      sidewalkLines.push(
        <Line key={`${id}-swr-fill`} points={buildOffsetSpine(spine, -swOff)}
          stroke="rgba(200,195,185,0.6)" strokeWidth={sidewalkWidth} lineCap="round" lineJoin="round" listening={false} />,
        <Line key={`${id}-swr-edge`} points={buildOffsetSpine(spine, -(swOff + sidewalkWidth / 2))}
          stroke="rgba(160,155,145,0.8)" strokeWidth={1} lineCap="round" lineJoin="round" listening={false} />,
      );
    }
  }

  if (shoulderWidth > 0) {
    const shoulderOff = hw + shoulderWidth / 2;
    shoulderLines.push(
      <Line key={`${id}-sl`} points={buildOffsetSpine(spine, shoulderOff)}
        stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth} lineCap="round" lineJoin="round" listening={false} />,
      <Line key={`${id}-sr`} points={buildOffsetSpine(spine, -shoulderOff)}
        stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth} lineCap="round" lineJoin="round" listening={false} />,
    );
  }

  return [...sidewalkLines, ...shoulderLines];
}

interface PolylineRoadProps { obj: PolylineRoadObject; isSelected: boolean; }
export function PolylineRoad({ obj, isSelected }: PolylineRoadProps) {
  const { id, points, width, lanes, roadType, smooth, shoulderWidth = 0, sidewalkWidth = 0, sidewalkSide } = obj;
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
            <Line key={`${id}-c${li}_${si}_${d}`}
              points={[x1 + cx * (off + d), y1 + cy * (off + d), x2 + cx * (off + d), y2 + cy * (off + d)]}
              stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
          );
        }
      } else {
        laneMarkings.push(
          <Line key={`${id}-l${li}_${si}`}
            points={[x1 + cx * off, y1 + cy * off, x2 + cx * off, y2 + cy * off]}
            stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
        );
      }
    }
  }

  const extraLines = buildShoulderSidewalkLines(id, pts, hw, shoulderWidth, sidewalkWidth, sidewalkSide);
  const isBikeLane = roadType === 'bike_lane';
  const fillColor  = isBikeLane ? COLORS.bikeLane : COLORS.road;
  const edgeColor  = isBikeLane ? COLORS.bikeLaneStripe : COLORS.roadLineWhite;

  return (
    <Group listening={false}>
      {extraLines}
      <Line points={flat} stroke="#444" strokeWidth={width + 4} lineCap="round" lineJoin="round" tension={tension} />
      <Line points={flat} stroke={edgeColor} strokeWidth={width} lineCap="round" lineJoin="round" tension={tension} />
      <Line points={flat} stroke={fillColor} strokeWidth={width - 4} lineCap="round" lineJoin="round" tension={tension} />
      {isBikeLane && <Line points={flat} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dash={[8, 12]} lineCap="round" lineJoin="round" tension={tension} listening={false} />}
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
export function CurveRoad({ obj, isSelected }: CurveRoadProps) {
  const { id, points, width, lanes, roadType, shoulderWidth = 0, sidewalkWidth = 0, sidewalkSide } = obj;
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
            <Line key={`${id}-c${li}_${si}_${d}`}
              points={[x1 + cx * (off + d), y1 + cy * (off + d), x2 + cx * (off + d), y2 + cy * (off + d)]}
              stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
          );
        }
      } else {
        laneMarkings.push(
          <Line key={`${id}-l${li}_${si}`}
            points={[x1 + cx * off, y1 + cy * off, x2 + cx * off, y2 + cy * off]}
            stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
        );
      }
    }
  }

  const extraLines = buildShoulderSidewalkLines(id, spine, hw, shoulderWidth, sidewalkWidth, sidewalkSide);
  const isBikeLane = roadType === 'bike_lane';
  const fillColor  = isBikeLane ? COLORS.bikeLane : COLORS.road;
  const edgeColor  = isBikeLane ? COLORS.bikeLaneStripe : COLORS.roadLineWhite;

  return (
    <Group listening={false}>
      {extraLines}
      <Line points={flat} stroke="#444" strokeWidth={width + 4} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={edgeColor} strokeWidth={width} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={fillColor} strokeWidth={width - 4} lineCap="round" lineJoin="round" tension={0} />
      {isBikeLane && <Line points={flat} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dash={[8, 12]} lineCap="round" lineJoin="round" tension={0} listening={false} />}
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
export function CubicBezierRoad({ obj, isSelected }: CubicBezierRoadProps) {
  const { id, points, width, lanes, roadType, shoulderWidth = 0, sidewalkWidth = 0, sidewalkSide } = obj;
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
            <Line key={`${id}-c${li}_${si}_${d}`}
              points={[x1 + cx * (off + d), y1 + cy * (off + d), x2 + cx * (off + d), y2 + cy * (off + d)]}
              stroke={COLORS.roadLine} strokeWidth={2} listening={false} />
          );
        }
      } else {
        laneMarkings.push(
          <Line key={`${id}-l${li}_${si}`}
            points={[x1 + cx * off, y1 + cy * off, x2 + cx * off, y2 + cy * off]}
            stroke={COLORS.laneMarking} strokeWidth={1.5} dash={[12, 18]} listening={false} />
        );
      }
    }
  }

  const extraLines = buildShoulderSidewalkLines(id, spine, hw, shoulderWidth, sidewalkWidth, sidewalkSide);
  const isBikeLane = roadType === 'bike_lane';
  const fillColor  = isBikeLane ? COLORS.bikeLane : COLORS.road;
  const edgeColor  = isBikeLane ? COLORS.bikeLaneStripe : COLORS.roadLineWhite;

  return (
    <Group listening={false}>
      {extraLines}
      <Line points={flat} stroke="#444" strokeWidth={width + 4} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={edgeColor} strokeWidth={width} lineCap="round" lineJoin="round" tension={0} />
      <Line points={flat} stroke={fillColor} strokeWidth={width - 4} lineCap="round" lineJoin="round" tension={0} />
      {isBikeLane && <Line points={flat} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dash={[8, 12]} lineCap="round" lineJoin="round" tension={0} listening={false} />}
      {laneMarkings}
      {isSelected && (
        <>
          <Line points={flat} stroke={COLORS.selected} strokeWidth={2} dash={[6, 4]} />
          <Line points={[p0.x, p0.y, p1.x, p1.y]} stroke="rgba(59,130,246,0.5)" strokeWidth={1} dash={[3, 3]} />
          <Line points={[p2.x, p2.y, p3.x, p3.y]} stroke="rgba(59,130,246,0.5)" strokeWidth={1} dash={[3, 3]} />
          <Circle x={p0.x} y={p0.y} radius={6} fill={COLORS.success} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Circle x={p3.x} y={p3.y} radius={6} fill={COLORS.success} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Circle x={p1.x} y={p1.y} radius={5} fill={COLORS.info} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
          <Circle x={p2.x} y={p2.y} radius={5} fill={COLORS.info} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        </>
      )}
    </Group>
  );
}

interface SignShapeProps { obj: SignObject; isSelected: boolean; }
export function SignShape({ obj, isSelected }: SignShapeProps) {
  const { x, y, signData, rotation = 0, scale: sc = 1 } = obj;
  const s = 12 * sc;
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
        const baseFontSize = label.length <= 4 ? 8 : label.length <= 8 ? 6.5 : 5;
        ctx.font = `bold ${Math.max(4, baseFontSize * sc)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 0, shp === "triangle" ? 4 : 0);
      }}
    />
  );
}

/** Draw the amber LED matrix for a specific arrow board mode. */
function drawArrowBoard(ctx: KonvaContext, mode: ArrowBoardMode) {
  const W = 28, H = 18; // board dims in canvas px
  // Board background
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-W / 2, -H / 2, W, H);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#fbbf24'; // amber LED colour

  if (mode === 'right') {
    // Right-pointing chevron arrow →
    ctx.beginPath();
    ctx.moveTo(-10, -6); ctx.lineTo(2, -6); ctx.lineTo(2, -10);
    ctx.lineTo(10, 0);
    ctx.lineTo(2, 10); ctx.lineTo(2, 6); ctx.lineTo(-10, 6);
    ctx.closePath(); ctx.fill();
  } else if (mode === 'left') {
    // Left-pointing chevron arrow ←
    ctx.beginPath();
    ctx.moveTo(10, -6); ctx.lineTo(-2, -6); ctx.lineTo(-2, -10);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-2, 10); ctx.lineTo(-2, 6); ctx.lineTo(10, 6);
    ctx.closePath(); ctx.fill();
  } else if (mode === 'caution') {
    // Diamond ◇ pattern
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(9, 0); ctx.lineTo(0, 7); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill();
  } else {
    // Flashing — fill whole board with reduced opacity to suggest flash
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-W / 2 + 2, -H / 2 + 2, W - 4, H - 4);
    ctx.globalAlpha = 1;
  }

  // Mode label below board
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "7px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(mode.toUpperCase(), 0, H / 2 + 2);
}

interface DeviceShapeProps { obj: DeviceObject; isSelected: boolean; }
export function DeviceShape({ obj, isSelected }: DeviceShapeProps) {
  const { x, y, deviceData, rotation = 0, arrowBoardMode = 'right' } = obj;
  const isArrowBoard = deviceData.id === 'arrow_board';
  return (
    <Shape
      x={x} y={y}
      rotation={rotation}
      shadowColor={isSelected ? COLORS.selected : undefined}
      shadowBlur={isSelected ? 12 : 0}
      listening={false}
      sceneFunc={(ctx: KonvaContext) => {
        if (isArrowBoard) {
          drawArrowBoard(ctx, arrowBoardMode);
        } else {
          ctx.fillStyle = deviceData.color;
          ctx.font = "22px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(deviceData.icon, 0, 0);
          ctx.fillStyle = COLORS.textMuted;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillText(deviceData.label, 0, 18);
        }
      }}
    />
  );
}

interface WorkZoneProps { obj: ZoneObject; isSelected: boolean; }
export function WorkZone({ obj, isSelected }: WorkZoneProps) {
  const { x, y, w, h } = obj;
  const hatches = [];
  const maxD = Math.max(w, h);
  for (let i = -maxD; i < maxD * 2; i += 20) {
    hatches.push(
      <Line key={i} points={[x + i, y, x + i + h, y + h]} stroke="rgba(245,158,11,0.35)" strokeWidth={1.5} listening={false} />
    );
  }
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={w} height={h} fill="rgba(245,158,11,0.22)"
        stroke={isSelected ? COLORS.selected : "rgba(245,158,11,0.85)"} strokeWidth={2} dash={[8, 6]} />
      {hatches}
      <KonvaText x={x} y={y} width={w} height={h} text="WORK ZONE"
        fontSize={11} fontStyle="bold" fontFamily="'JetBrains Mono', monospace"
        fill={COLORS.accent} align="center" verticalAlign="middle" />
    </Group>
  );
}

interface ArrowShapeProps { obj: ArrowObject; isSelected: boolean; }
export function ArrowShape({ obj, isSelected }: ArrowShapeProps) {
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
export function TextLabel({ obj, isSelected }: TextLabelProps) {
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
export function MeasurementShape({ obj }: MeasurementShapeProps) {
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

interface TaperShapeProps { obj: TaperObject; isSelected: boolean; }
export function TaperShape({ obj, isSelected }: TaperShapeProps) {
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
export function ObjectShape({ obj, isSelected }: ObjectShapeProps) {
  switch (obj.type) {
    case "road":               return <RoadSegment obj={obj} isSelected={isSelected} />;
    case "polyline_road":      return <PolylineRoad obj={obj} isSelected={isSelected} />;
    case "curve_road":         return <CurveRoad obj={obj} isSelected={isSelected} />;
    case "cubic_bezier_road":  return <CubicBezierRoad obj={obj} isSelected={isSelected} />;
    case "sign":               return <SignShape obj={obj} isSelected={isSelected} />;
    case "device":             return <DeviceShape obj={obj} isSelected={isSelected} />;
    case "zone":               return <WorkZone obj={obj} isSelected={isSelected} />;
    case "arrow":              return <ArrowShape obj={obj} isSelected={isSelected} />;
    case "text":               return <TextLabel obj={obj} isSelected={isSelected} />;
    case "measure":            return <MeasurementShape obj={obj} />;
    case "taper":              return <TaperShape obj={obj} isSelected={isSelected} />;
    case "lane_mask":          return <LaneMaskShape obj={obj} isSelected={isSelected} />;
    case "crosswalk":          return <CrosswalkShape obj={obj} isSelected={isSelected} />;
    case "turn_lane":          return <TurnLaneShape obj={obj} isSelected={isSelected} />;
    default:                   return null;
  }
}
