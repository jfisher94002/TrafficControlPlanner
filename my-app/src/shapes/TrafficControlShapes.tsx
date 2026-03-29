import { Group, Line, Shape } from "react-konva";
import type { Context as KonvaContext } from 'konva/lib/Context';
import type { LaneMaskObject, TurnLaneObject, CrosswalkObject } from '../types';

const SELECTED_COLOR = "#818cf8";

// ─── LaneMaskShape ────────────────────────────────────────────────────────────

interface LaneMaskShapeProps { obj: LaneMaskObject; isSelected: boolean; }
export function LaneMaskShape({ obj, isSelected }: LaneMaskShapeProps) {
  const { x1, y1, x2, y2, laneWidth, color, style } = obj;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;
  const hw = laneWidth / 2;

  if (style === 'solid') {
    return (
      <Group listening={false}>
        <Line
          points={[x1, y1, x2, y2]}
          stroke={color}
          strokeWidth={laneWidth}
          lineCap="butt"
        />
        {isSelected && (
          <Line
            points={[x1, y1, x2, y2]}
            stroke="white"
            strokeWidth={laneWidth + 4}
            lineCap="butt"
            dash={[8, 6]}
            opacity={0.5}
          />
        )}
      </Group>
    );
  }

  // Hatch style: solid band + diagonal hatch lines clipped to band
  const corners = [
    x1 + px * hw, y1 + py * hw,
    x2 + px * hw, y2 + py * hw,
    x2 - px * hw, y2 - py * hw,
    x1 - px * hw, y1 - py * hw,
  ];

  return (
    <Group listening={false}>
      {/* Selection outline — drawn first (behind) */}
      {isSelected && (
        <Line
          points={[x1, y1, x2, y2]}
          stroke="white"
          strokeWidth={laneWidth + 4}
          lineCap="butt"
          dash={[8, 6]}
          opacity={0.5}
        />
      )}
      {/* Solid colored band */}
      <Line points={corners} closed fill={color} stroke="none" strokeWidth={0} />
      {/* Hatch overlay via sceneFunc */}
      <Shape
        listening={false}
        sceneFunc={(ctx: KonvaContext) => {
          // Build clip region (the band rectangle)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(corners[0], corners[1]);
          ctx.lineTo(corners[2], corners[3]);
          ctx.lineTo(corners[4], corners[5]);
          ctx.lineTo(corners[6], corners[7]);
          ctx.closePath();
          ctx.clip();

          // Draw diagonal hatch lines across an extended bounding box
          const minX = Math.min(corners[0], corners[2], corners[4], corners[6]);
          const maxX = Math.max(corners[0], corners[2], corners[4], corners[6]);
          const minY = Math.min(corners[1], corners[3], corners[5], corners[7]);
          const maxY = Math.max(corners[1], corners[3], corners[5], corners[7]);
          const ext = laneWidth + 20;
          const spacing = 10;
          const diagLen = (maxX - minX) + (maxY - minY) + ext * 2;

          ctx.strokeStyle = "rgba(180,30,30,0.7)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = -diagLen; i < diagLen * 2; i += spacing) {
            ctx.moveTo(minX - ext + i, minY - ext);
            ctx.lineTo(minX - ext + i + diagLen, minY - ext + diagLen);
          }
          ctx.stroke();
          ctx.restore();
        }}
      />
    </Group>
  );
}

// ─── TurnLaneShape ────────────────────────────────────────────────────────────

interface TurnLaneShapeProps { obj: TurnLaneObject; isSelected: boolean; }
export function TurnLaneShape({ obj, isSelected }: TurnLaneShapeProps) {
  const { x, y, rotation, laneWidth, taperLength, runLength, side, turnDir } = obj;
  const sign = side === 'right' ? 1 : -1;

  return (
    <Shape
      x={x} y={y}
      rotation={rotation}
      shadowColor={isSelected ? SELECTED_COLOR : undefined}
      shadowBlur={isSelected ? 12 : 0}
      listening={false}
      sceneFunc={(ctx: KonvaContext) => {
        // Draw taper section (triangle/trapezoid)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(taperLength, 0);
        ctx.lineTo(taperLength, sign * laneWidth);
        ctx.closePath();
        ctx.fillStyle = "rgba(70,80,100,0.85)";
        ctx.fill();

        // Draw run section (rectangle)
        ctx.beginPath();
        ctx.moveTo(taperLength, 0);
        ctx.lineTo(taperLength + runLength, 0);
        ctx.lineTo(taperLength + runLength, sign * laneWidth);
        ctx.lineTo(taperLength, sign * laneWidth);
        ctx.closePath();
        ctx.fill();

        // Outer edge line (diagonal taper edge + run outer edge)
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(taperLength, sign * laneWidth);
        ctx.lineTo(taperLength + runLength, sign * laneWidth);
        ctx.stroke();

        // Inner edge line (along road direction, run section only)
        ctx.beginPath();
        ctx.moveTo(taperLength, 0);
        ctx.lineTo(taperLength + runLength, 0);
        ctx.stroke();

        // End cap
        ctx.beginPath();
        ctx.moveTo(taperLength + runLength, 0);
        ctx.lineTo(taperLength + runLength, sign * laneWidth);
        ctx.stroke();

        // Centerline dashes in run section
        ctx.strokeStyle = "rgba(255,220,0,0.7)";
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(taperLength, sign * laneWidth / 2);
        ctx.lineTo(taperLength + runLength * 0.7, sign * laneWidth / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Turn arrow
        const ax = taperLength + runLength * 0.8;
        const ay = sign * laneWidth / 2;
        const arrowSize = Math.min(laneWidth * 0.35, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (turnDir === 'thru') {
          // Straight arrow pointing in +x direction
          ctx.moveTo(ax - arrowSize, ay);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - arrowSize * 0.4, ay - arrowSize * 0.4);
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - arrowSize * 0.4, ay + arrowSize * 0.4);
          ctx.stroke();
        } else if (turnDir === 'right') {
          // Right turn arrow (curves toward +y for side=right)
          ctx.moveTo(ax - arrowSize, ay);
          ctx.lineTo(ax, ay);
          ctx.lineTo(ax, ay + sign * arrowSize);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax, ay + sign * arrowSize);
          ctx.lineTo(ax - arrowSize * 0.4, ay + sign * arrowSize * 0.6);
          ctx.moveTo(ax, ay + sign * arrowSize);
          ctx.lineTo(ax + arrowSize * 0.4, ay + sign * arrowSize * 0.6);
          ctx.stroke();
        } else {
          // Left turn arrow
          ctx.moveTo(ax + arrowSize, ay);
          ctx.lineTo(ax, ay);
          ctx.lineTo(ax, ay + sign * arrowSize);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax, ay + sign * arrowSize);
          ctx.lineTo(ax - arrowSize * 0.4, ay + sign * arrowSize * 0.6);
          ctx.moveTo(ax, ay + sign * arrowSize);
          ctx.lineTo(ax + arrowSize * 0.4, ay + sign * arrowSize * 0.6);
          ctx.stroke();
        }
      }}
    />
  );
}

// ─── CrosswalkShape ───────────────────────────────────────────────────────────

interface CrosswalkShapeProps { obj: CrosswalkObject; isSelected: boolean; }
export function CrosswalkShape({ obj, isSelected }: CrosswalkShapeProps) {
  const { x1, y1, x2, y2, depth, stripeCount, stripeColor } = obj;
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx: KonvaContext) => {
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (len < 2) return;
        const dx = (x2 - x1) / len, dy = (y2 - y1) / len; // along crosswalk width
        const px = -dy, py = dx;                             // perpendicular (road direction)
        const sw = len / (2 * stripeCount - 1);              // stripe width

        ctx.save();
        ctx.translate(x1, y1);

        // Draw stripeCount white rectangles
        for (let i = 0; i < stripeCount; i++) {
          const offset = i * 2 * sw;
          ctx.fillStyle = stripeColor;
          ctx.beginPath();
          ctx.moveTo(dx * offset - px * depth / 2,         dy * offset - py * depth / 2);
          ctx.lineTo(dx * (offset + sw) - px * depth / 2,  dy * (offset + sw) - py * depth / 2);
          ctx.lineTo(dx * (offset + sw) + px * depth / 2,  dy * (offset + sw) + py * depth / 2);
          ctx.lineTo(dx * offset + px * depth / 2,          dy * offset + py * depth / 2);
          ctx.closePath();
          ctx.fill();
        }

        // Outline around the whole crosswalk rectangle
        ctx.strokeStyle = isSelected ? SELECTED_COLOR : "rgba(0,0,0,0.6)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash(isSelected ? [6, 4] : []);
        ctx.beginPath();
        ctx.moveTo(-px * depth / 2,              -py * depth / 2);
        ctx.lineTo(dx * len - px * depth / 2,    dy * len - py * depth / 2);
        ctx.lineTo(dx * len + px * depth / 2,    dy * len + py * depth / 2);
        ctx.lineTo(px * depth / 2,               py * depth / 2);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      }}
    />
  );
}
