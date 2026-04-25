import { Group, Line, Text, Circle } from 'react-konva';
import type { TaperObject } from '../../../types';
import { TAPER_SCALE, SIGN_LATERAL_CLEARANCE_PX } from '../../../features/tcp/constants';
import { mutcdSignSpacingFt } from '../../../utils';

const SIGN_SEQUENCE = [
  { label: 'ONE LANE RD', mutcd: 'W20-4a' },
  { label: 'ROAD WORK',   mutcd: 'W20-1'  },
  { label: 'WORK AHEAD',  mutcd: 'W20-1'  },
] as const;

const GUIDE_COLOR = 'rgba(99,179,237,0.75)';
const LABEL_COLOR = 'rgba(99,179,237,0.95)';
const SIGN_COLOR  = 'rgba(249,115,22,0.9)';

interface SpacingOverlayProps {
  taper: TaperObject;
}

export interface SpacingGuideMarker {
  label: string;
  mutcd: string;
  x: number;
  distanceFt: number;
}

export interface SpacingGuideGeometry {
  spacingFt: number;
  spacingPx: number;
  hw: number;
  lineHalfLen: number;
  signDotY: number;
  markers: SpacingGuideMarker[];
}

/** Pure geometry calculation — exported for regression tests. */
export function getSpacingGuideGeometry(taper: TaperObject): SpacingGuideGeometry {
  const spacingFt = mutcdSignSpacingFt(taper.speed);
  const spacingPx = spacingFt * TAPER_SCALE;
  const hw = (taper.laneWidth * taper.numLanes * TAPER_SCALE) / 2;
  const lineHalfLen = hw + 90;
  const signDotY = hw + SIGN_LATERAL_CLEARANCE_PX;
  const markers = SIGN_SEQUENCE.map(({ label, mutcd }, i) => ({
    label,
    mutcd,
    x: -(i + 1) * spacingPx,
    distanceFt: (i + 1) * spacingFt,
  }));

  return { spacingFt, spacingPx, hw, lineHalfLen, signDotY, markers };
}

export function SpacingOverlay({ taper }: SpacingOverlayProps) {
  const { hw, lineHalfLen, signDotY, markers } = getSpacingGuideGeometry(taper);

  return (
    <Group x={taper.x} y={taper.y} rotation={taper.rotation} listening={false}>
      {/* Road-width indicator at taper origin */}
      <Line
        points={[0, -hw, 0, hw]}
        stroke="rgba(249,115,22,0.45)"
        strokeWidth={2}
        dash={[4, 4]}
        listening={false}
      />

      {markers.map(({ label, mutcd, x, distanceFt }) => {
        return (
          <Group key={mutcd + label} x={x} y={0} listening={false}>
            {/* Dashed guide line perpendicular to road */}
            <Line
              points={[0, -lineHalfLen, 0, lineHalfLen]}
              stroke={GUIDE_COLOR}
              strokeWidth={1.5}
              dash={[8, 5]}
              listening={false}
            />

            {/* Distance label — top of line */}
            <Text
              x={5}
              y={-lineHalfLen}
              text={`${distanceFt} ft`}
              fontSize={11}
              fontStyle="bold"
              fill={LABEL_COLOR}
              listening={false}
            />

            {/* Sign name + MUTCD code — just below distance */}
            <Text
              x={5}
              y={-lineHalfLen + 14}
              text={`${label} (${mutcd})`}
              fontSize={9}
              fill={SIGN_COLOR}
              listening={false}
            />

            {/* Dot at the expected sign position — lateral offset (y) in taper-local space */}
            <Circle
              x={0}
              y={signDotY}
              radius={5}
              fill={GUIDE_COLOR}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1}
              listening={false}
            />

            {/* Tick marks at road edges */}
            <Line
              points={[0, -hw - 6, 0, -hw + 6]}
              stroke={GUIDE_COLOR}
              strokeWidth={2}
              listening={false}
            />
            <Line
              points={[0, hw - 6, 0, hw + 6]}
              stroke={GUIDE_COLOR}
              strokeWidth={2}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}
