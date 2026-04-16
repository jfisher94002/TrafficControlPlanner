import type React from 'react';
import { Line, Rect, Circle } from 'react-konva';
import type { DrawStart, Point, LaneMaskObject, CrosswalkObject } from '../../../types';
import { sampleBezier, sampleCubicBezier } from '../../../utils';
import { COLORS } from '../../../features/tcp/constants';
import { LaneMaskShape, CrosswalkShape } from '../../../shapes/TrafficControlShapes';

interface DrawingOverlaysProps {
  tool: string;
  roadDrawMode: string;
  drawStart: DrawStart | null;
  cursorPos: Point;
  snapIndicator: Point | null;
  polyPoints: Point[];
  curvePoints: Point[];
  cubicPoints: Point[];
}

export function DrawingOverlays({ tool, roadDrawMode, drawStart, cursorPos, snapIndicator, polyPoints, curvePoints, cubicPoints }: DrawingOverlaysProps) {
  const previewTarget = snapIndicator || cursorPos;
  const elements: React.ReactNode[] = [];

  if (drawStart && tool === "road" && roadDrawMode === "straight") {
    elements.push(
      <Line key="road-preview"
        points={[drawStart.x, drawStart.y, previewTarget.x, previewTarget.y]}
        stroke="rgba(245,158,11,0.5)" strokeWidth={1} dash={[6, 4]} listening={false} />
    );
  }

  if (drawStart && tool === "zone") {
    const zx = Math.min(drawStart.x, cursorPos.x), zy = Math.min(drawStart.y, cursorPos.y);
    elements.push(
      <Rect key="zone-preview" x={zx} y={zy}
        width={Math.abs(cursorPos.x - drawStart.x)} height={Math.abs(cursorPos.y - drawStart.y)}
        stroke="rgba(245,158,11,0.5)" strokeWidth={1} dash={[6, 4]} listening={false} />
    );
  }

  if (drawStart && (tool === "arrow" || tool === "measure")) {
    elements.push(
      <Line key="line-preview"
        points={[drawStart.x, drawStart.y, cursorPos.x, cursorPos.y]}
        stroke="rgba(245,158,11,0.5)" strokeWidth={1} dash={[6, 4]} listening={false} />
    );
  }

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

  if (tool === "road" && roadDrawMode === "cubic" && cubicPoints.length > 0) {
    const [q0, q1, q2] = cubicPoints;
    if (cubicPoints.length === 1) {
      elements.push(
        <Line key="cubic-preview-1"
          points={[q0.x, q0.y, previewTarget.x, previewTarget.y]}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} listening={false} />
      );
    } else if (cubicPoints.length === 2) {
      const spine = sampleCubicBezier(q0, q1, previewTarget, previewTarget, 20);
      elements.push(
        <Line key="cubic-preview-2" points={spine.flatMap((p) => [p.x, p.y])}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} tension={0} listening={false} />
      );
      elements.push(
        <Line key="cubic-tangent-1-2pt"
          points={[q0.x, q0.y, q1.x, q1.y]}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} dash={[3, 3]} listening={false} />
      );
    } else {
      const spine = sampleCubicBezier(q0, q1, q2, previewTarget, 20);
      elements.push(
        <Line key="cubic-preview-3" points={spine.flatMap((p) => [p.x, p.y])}
          stroke="rgba(245,158,11,0.65)" strokeWidth={2} dash={[6, 4]} tension={0} listening={false} />
      );
      elements.push(
        <Line key="cubic-tangent-1-3pt"
          points={[q0.x, q0.y, q1.x, q1.y]}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} dash={[3, 3]} listening={false} />
      );
      elements.push(
        <Line key="cubic-tangent-2-3pt"
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
