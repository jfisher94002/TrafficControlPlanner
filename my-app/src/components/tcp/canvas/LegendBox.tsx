import { useMemo } from 'react';
import type React from 'react';
import type { CanvasObject, SignData } from '../../../types';
import { COLORS, STATUS_BAR_H } from '../../../features/tcp/constants';

// ─── Sign Icon SVG ────────────────────────────────────────────────────────────

export function SignIconSvg({ signData, size = 22 }: { signData: SignData; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const { shape, color, textColor, label } = signData;
  let shapeEl: React.ReactElement;
  if (shape === "octagon") {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    }).join(" ");
    shapeEl = <polygon points={pts} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else if (shape === "diamond") {
    shapeEl = <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={color} stroke="#111" strokeWidth="1.5" />;
  } else if (shape === "triangle") {
    shapeEl = <polygon points={`${cx},${cy - r} ${cx + r},${cy + r * 0.7} ${cx - r},${cy + r * 0.7}`} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else if (shape === "circle") {
    shapeEl = <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else if (shape === "shield") {
    shapeEl = <polygon points={`${cx - r * 0.7},${cy - r} ${cx + r * 0.7},${cy - r} ${cx + r * 0.8},${cy - r * 0.3} ${cx},${cy + r} ${cx - r * 0.8},${cy - r * 0.3}`} fill={color} stroke="#fff" strokeWidth="1.5" />;
  } else {
    shapeEl = <rect x={cx - r} y={cy - r * 0.65} width={r * 2} height={r * 1.3} fill={color} stroke={signData.border || "#333"} strokeWidth="1.5" />;
  }
  const shortLabel = label.length > 5 ? label.slice(0, 4) + "\u2026" : label;
  const fontSize = label.length <= 3 ? 6 : label.length <= 5 ? 5 : 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-hidden="true">
      {shapeEl}
      <text x={cx} y={shape === "triangle" ? cy + r * 0.3 : cy + 1.5} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight="bold" fill={textColor || "#fff"} fontFamily="'JetBrains Mono',monospace">
        {shortLabel}
      </text>
    </svg>
  );
}

// ─── Legend Box ───────────────────────────────────────────────────────────────

interface LegendBoxProps { objects: CanvasObject[]; visible: boolean; }

export function LegendBox({ objects, visible }: LegendBoxProps) {
  const { signEntries, deviceEntries } = useMemo(() => {
    const signMap: Record<string, { signData: SignData; count: number }> = {};
    const deviceMap: Record<string, { id: string; icon: string; label: string; count: number }> = {};
    for (const obj of objects) {
      if (obj.type === "sign") {
        const key = obj.signData.id;
        if (!signMap[key]) signMap[key] = { signData: obj.signData, count: 0 };
        signMap[key].count++;
      } else if (obj.type === "device") {
        const key = obj.deviceData.id;
        if (!deviceMap[key]) deviceMap[key] = { id: key, icon: obj.deviceData.icon, label: obj.deviceData.label, count: 0 };
        deviceMap[key].count++;
      }
    }
    return { signEntries: Object.values(signMap), deviceEntries: Object.values(deviceMap) };
  }, [objects]);

  if (!visible || (signEntries.length === 0 && deviceEntries.length === 0)) return null;

  return (
    <div data-testid="legend-box" style={{
      position: "absolute", bottom: STATUS_BAR_H + 8, left: 12,
      background: "rgba(26,29,39,0.92)", border: `1px solid ${COLORS.panelBorder}`,
      borderRadius: 6, padding: "6px 8px", pointerEvents: "none", zIndex: 10,
      minWidth: 130, maxWidth: 200,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>
        Legend
      </div>
      {signEntries.map(({ signData, count }) => (
        <div key={signData.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <SignIconSvg signData={signData} size={20} />
          <span data-testid="legend-item-label" style={{ fontSize: 10, color: COLORS.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signData.label}</span>
          <span data-testid="legend-count" style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: COLORS.text, fontWeight: 600 }}>{count}</span>
        </div>
      ))}
      {deviceEntries.map(({ id, label, icon, count }) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 20, textAlign: "center", fontSize: 13, flexShrink: 0 }} aria-hidden="true">{icon}</span>
          <span data-testid="legend-item-label" style={{ fontSize: 10, color: COLORS.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <span data-testid="legend-count" style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: COLORS.text, fontWeight: 600 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── North Arrow ──────────────────────────────────────────────────────────────

const northArrowStyle: React.CSSProperties = {
  position: "absolute",
  bottom: STATUS_BAR_H + 8,
  right: 12,
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "rgba(26,29,39,0.88)",
  border: `1px solid ${COLORS.panelBorder}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 10,
};

export function NorthArrow({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div data-testid="north-arrow" style={northArrowStyle}>
      <svg width="36" height="36" viewBox="0 0 36 36" role="img">
        <title>North arrow</title>
        <polygon points="18,5 15,19 21,19" fill={COLORS.danger} />
        <polygon points="18,31 15,19 21,19" fill={COLORS.textDim} />
        <circle cx="18" cy="19" r="2.5" fill={COLORS.text} />
        <text x="18" y="4" textAnchor="middle" dominantBaseline="auto" fontSize="7" fontWeight="bold" fill={COLORS.danger} fontFamily="'JetBrains Mono',monospace">N</text>
      </svg>
    </div>
  );
}
