import { useMemo } from 'react';
import type { CanvasObject } from '../../../types';
import { isRoad } from '../../../utils';
import { COLORS } from '../../../features/tcp/constants';
import { sectionTitle } from '../../../features/tcp/panelHelpers';

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

export function ManifestPanel({ objects }: { objects: CanvasObject[] }) {
  const {
    signCounts,
    deviceCounts,
    roads,
    tapers,
    turnLanes,
    zones,
    arrows,
    texts,
    measures,
    laneMasks,
    crosswalks,
    hasAny,
    otherCount,
  } = useMemo(() => {
    const nextSignCounts: Record<string, number> = {};
    const nextDeviceCounts: Record<string, number> = {};
    let roadsCount = 0, tapersCount = 0, turnLanesCount = 0, zonesCount = 0;
    let arrowsCount = 0, textsCount = 0, measuresCount = 0, laneMasksCount = 0, crosswalksCount = 0;

    for (const obj of objects) {
      if (obj.type === "sign") {
        nextSignCounts[obj.signData.label] = (nextSignCounts[obj.signData.label] ?? 0) + 1;
      } else if (obj.type === "device") {
        nextDeviceCounts[obj.deviceData.label] = (nextDeviceCounts[obj.deviceData.label] ?? 0) + 1;
      } else if (isRoad(obj)) { roadsCount++;
      } else if (obj.type === "taper") { tapersCount++;
      } else if (obj.type === "turn_lane") { turnLanesCount++;
      } else if (obj.type === "zone") { zonesCount++;
      } else if (obj.type === "arrow") { arrowsCount++;
      } else if (obj.type === "text") { textsCount++;
      } else if (obj.type === "measure") { measuresCount++;
      } else if (obj.type === "lane_mask") { laneMasksCount++;
      } else if (obj.type === "crosswalk") { crosswalksCount++;
      }
    }

    return {
      signCounts: nextSignCounts,
      deviceCounts: nextDeviceCounts,
      roads: roadsCount, tapers: tapersCount, turnLanes: turnLanesCount,
      zones: zonesCount, arrows: arrowsCount, texts: textsCount,
      measures: measuresCount, laneMasks: laneMasksCount, crosswalks: crosswalksCount,
      hasAny: objects.length > 0,
      otherCount: roadsCount + tapersCount + turnLanesCount + zonesCount + arrowsCount + textsCount + measuresCount + laneMasksCount + crosswalksCount,
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
          {roads      > 0 && <ManifestRow icon="━"  label="Road segments" count={roads} />}
          {tapers     > 0 && <ManifestRow icon="⋈"  label="Tapers"        count={tapers} />}
          {turnLanes  > 0 && <ManifestRow icon="↰"  label="Turn Lanes"    count={turnLanes} />}
          {laneMasks  > 0 && <ManifestRow icon="▧"  label="Lane Masks"    count={laneMasks} />}
          {crosswalks > 0 && <ManifestRow icon="⊟"  label="Crosswalks"    count={crosswalks} />}
          {zones      > 0 && <ManifestRow icon="▨"  label="Work zones"    count={zones} />}
          {arrows     > 0 && <ManifestRow icon="→"  label="Arrows"        count={arrows} />}
          {texts      > 0 && <ManifestRow icon="T"  label="Text labels"   count={texts} />}
          {measures   > 0 && <ManifestRow icon="📏" label="Measurements"  count={measures} />}
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
