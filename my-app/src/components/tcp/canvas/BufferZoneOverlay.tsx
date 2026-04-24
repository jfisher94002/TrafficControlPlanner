import { Group, Rect, Line, Text } from 'react-konva';
import type { TaperObject } from '../../../types';
import { TAPER_SCALE } from '../../../features/tcp/constants';
import { mutcdSignSpacingFt } from '../../../utils';

/** MUTCD orange — matches ATSSA spec for temporary traffic control */
const BUFFER_FILL   = 'rgba(249,115,22,0.12)';
const BUFFER_STROKE = 'rgba(249,115,22,0.7)';
const HATCH_COLOR   = 'rgba(249,115,22,0.25)';
const LABEL_COLOR   = 'rgba(249,115,22,0.95)';

export interface BufferZoneGeometry {
  /** Left edge of buffer rect in taper-local x (negative = upstream) */
  rectX: number;
  /** Width of buffer rect in px (= 1× advance sign spacing) */
  rectW: number;
  /** Height of buffer rect in px (= full road width) */
  rectH: number;
  /** Half road width in px */
  hw: number;
  /** Buffer distance in feet, for the label */
  spacingFt: number;
}

/** Pure geometry calculation — exported for testability. */
export function getBufferZoneGeometry(taper: TaperObject): BufferZoneGeometry {
  const spacingFt = mutcdSignSpacingFt(taper.speed);
  const spacingPx = spacingFt * TAPER_SCALE;
  const hw = (taper.laneWidth * taper.numLanes * TAPER_SCALE) / 2;
  return {
    rectX: -spacingPx,
    rectW: spacingPx,
    rectH: hw * 2,
    hw,
    spacingFt,
  };
}

interface BufferZoneOverlayProps {
  taper: TaperObject;
}

export function BufferZoneOverlay({ taper }: BufferZoneOverlayProps) {
  const { rectX, rectW, rectH, hw, spacingFt } = getBufferZoneGeometry(taper);

  // Diagonal hatch lines at 45°, spaced every 12px
  const hatchSpacing = 12;
  const hatchLines: number[][] = [];
  for (let d = -rectH; d <= rectW + rectH; d += hatchSpacing) {
    // Line clipped to rect by Group clipX/clipY/clipWidth/clipHeight
    hatchLines.push([rectX + d, -hw, rectX + d + rectH, hw]);
  }

  return (
    <Group x={taper.x} y={taper.y} rotation={taper.rotation} listening={false}>
      {/* Translucent fill */}
      <Rect
        x={rectX} y={-hw}
        width={rectW} height={rectH}
        fill={BUFFER_FILL}
        stroke={BUFFER_STROKE}
        strokeWidth={1.5}
        dash={[6, 4]}
        listening={false}
      />

      {/* Hatch lines clipped by clipX/clipY/clipWidth/clipHeight on Group */}
      <Group
        clipX={rectX} clipY={-hw}
        clipWidth={rectW} clipHeight={rectH}
        listening={false}
      >
        {hatchLines.map((pts, i) => (
          <Line
            key={i}
            points={pts}
            stroke={HATCH_COLOR}
            strokeWidth={1}
            listening={false}
          />
        ))}
      </Group>

      {/* "BUFFER" label — top-left of the zone */}
      <Text
        x={rectX + 4}
        y={-hw + 4}
        text={`BUFFER  ${spacingFt} ft`}
        fontSize={10}
        fontStyle="bold"
        fill={LABEL_COLOR}
        listening={false}
      />
    </Group>
  );
}
