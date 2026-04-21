import { Group, Line, Text, Circle } from 'react-konva';
import type { TaperObject } from '../../../types';
import { TAPER_SCALE, SIGN_LATERAL_CLEARANCE_PX } from '../../../features/tcp/constants';

/** MUTCD Table 6H-3 advance warning sign spacing by speed. */
export function mutcdSpacingFt(speed: number): number {
  if (speed <= 35) return 100;
  if (speed <= 45) return 200;
  if (speed <= 55) return 350;
  if (speed <= 65) return 500;
  return 600;
}

const SIGN_SEQUENCE = [
  { label: 'ONE LANE RD', mutcd: 'W20-4a' },
  { label: 'ROAD WORK',   mutcd: 'W20-1'  },
  { label: 'WORK AHEAD',  mutcd: 'W20-1'  },
] as const;

const GUIDE_COLOR  = 'rgba(99,179,237,0.75)';
const LABEL_COLOR  = 'rgba(99,179,237,0.95)';
const SIGN_COLOR   = 'rgba(249,115,22,0.9)';

interface SpacingOverlayProps {
  taper: TaperObject;
}

export function SpacingOverlay({ taper }: SpacingOverlayProps) {
  const spacingFt = mutcdSpacingFt(taper.speed);
  const spacingPx = spacingFt * TAPER_SCALE;
  const hw = (taper.laneWidth * taper.numLanes * TAPER_SCALE) / 2;
  const lineHalfLen = hw + 90;
  const signDotX = hw + SIGN_LATERAL_CLEARANCE_PX;

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

      {SIGN_SEQUENCE.map(({ label, mutcd }, i) => {
        const lx = -(i + 1) * spacingPx;
        const distFt = (i + 1) * spacingFt;

        return (
          <Group key={i} x={lx} y={0} listening={false}>
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
              text={`${distFt} ft`}
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

            {/* Dot at the expected sign position (right of road) */}
            <Circle
              x={signDotX}
              y={0}
              radius={5}
              fill={GUIDE_COLOR}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1}
              listening={false}
            />

            {/* Tick at road edge */}
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
