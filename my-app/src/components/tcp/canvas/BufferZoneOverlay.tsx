import { Group, Rect, Line, Text } from 'react-konva';
import type { TaperObject } from '../../../types';
import { TAPER_SCALE } from '../../../features/tcp/constants';
import { mutcdSignSpacingFt } from '../../../utils';

/** MUTCD orange — matches ATSSA spec for temporary traffic control */
const BUFFER_FILL   = 'rgba(249,115,22,0.12)';
const BUFFER_STROKE = 'rgba(249,115,22,0.7)';
const HATCH_COLOR   = 'rgba(249,115,22,0.25)';
const LABEL_COLOR   = 'rgba(249,115,22,0.95)';

interface BufferZoneOverlayProps {
  taper: TaperObject;
}

export function BufferZoneOverlay({ taper }: BufferZoneOverlayProps) {
  const spacingFt = mutcdSignSpacingFt(taper.speed);
  const spacingPx = spacingFt * TAPER_SCALE;
  const hw = (taper.laneWidth * taper.numLanes * TAPER_SCALE) / 2;

  // Buffer rect in taper-local space:
  //   x: from -spacingPx (first advance sign) to 0 (taper origin)
  //   y: from -hw to +hw (road width)
  const rectX = -spacingPx;
  const rectW = spacingPx;
  const rectH = hw * 2;

  // Diagonal hatch lines at 45°, spaced every 12px
  const hatchSpacing = 12;
  const hatchLines: number[][] = [];
  const diagRange = rectW + rectH;
  for (let d = -rectH; d <= diagRange; d += hatchSpacing) {
    // Line from top-left corner to bottom-right, clipped to rect by clipRect on Group
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

      {/* Hatch lines clipped to the buffer rect */}
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

      {/* "BUFFER" label centred in the zone */}
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
