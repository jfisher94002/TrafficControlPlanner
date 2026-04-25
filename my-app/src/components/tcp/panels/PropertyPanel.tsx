import { useState } from 'react';
import type {
  CanvasObject, TaperObject, TurnLaneObject, LaneMaskObject, CrosswalkObject, PlanMeta, ArrowBoardMode,
} from '../../../types';
import { isPointObject, isLineObject, isMultiPointRoad, calcTaperLength } from '../../../utils';
import { COLORS } from '../../../features/tcp/constants';
import { sectionTitle, panelBtnStyle } from '../../../features/tcp/panelHelpers';

interface PropertyPanelProps {
  selected: string | null;
  objects: CanvasObject[];
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, dir: "front" | "forward" | "backward" | "back") => void;
  planMeta: PlanMeta;
  onUpdateMeta: (meta: PlanMeta) => void;
  onAutoChannelize: (taperId: string, workZoneLengthFt: number) => void;
  showSpacingGuide: boolean;
  onToggleSpacingGuide: () => void;
  showBufferZone: boolean;
  onToggleBufferZone: () => void;
}

export function PropertyPanel({ selected, objects, onUpdate, onDelete, onReorder, planMeta, onUpdateMeta, onAutoChannelize, showSpacingGuide, onToggleSpacingGuide, showBufferZone, onToggleBufferZone }: PropertyPanelProps) {
  const [workZoneLength, setWorkZoneLength] = useState(500);
  if (!selected) {
    return (
      <div style={{ padding: 12 }}>
        {sectionTitle("Plan Info")}
        {([["Project #", "projectNumber"], ["Client", "client"], ["Location", "location"]] as Array<[string, keyof PlanMeta]>).map(([label, key]) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, fontSize: 11, color: COLORS.textMuted }}>
            {label}
            <input value={planMeta[key]} onChange={(e) => onUpdateMeta({ ...planMeta, [key]: e.target.value })}
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "5px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit", outline: "none" }} />
          </label>
        ))}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: COLORS.textMuted }}>
          Notes
          <textarea value={planMeta.notes} onChange={(e) => onUpdateMeta({ ...planMeta, notes: e.target.value })}
            rows={3} style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "5px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
        </label>
      </div>
    );
  }

  const obj = objects.find((o) => o.id === selected);
  if (!obj) return null;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {obj.type === "polyline_road" ? "Polyline Road" : obj.type === "curve_road" ? "Quad Bézier Road" : obj.type === "cubic_bezier_road" ? "Cubic Bézier Road" : obj.type === "taper" ? "Taper" : obj.type === "lane_mask" ? "Lane Mask" : obj.type === "crosswalk" ? "Crosswalk" : obj.type === "turn_lane" ? "Turn Lane" : obj.type} Properties
      </div>

      {obj.type === "sign" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Rotation: {obj.rotation || 0}°
            <input type="range" min="0" max="360" value={obj.rotation || 0}
              onChange={(e) => onUpdate(obj.id, { rotation: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Scale: {(obj.scale || 1).toFixed(1)}
            <input type="range" min="0.5" max="3" step="0.1" value={obj.scale || 1}
              onChange={(e) => onUpdate(obj.id, { scale: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
        </div>
      )}

      {obj.type === "device" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Rotation: {obj.rotation || 0}°
            <input type="range" min="0" max="360" value={obj.rotation || 0}
              onChange={(e) => onUpdate(obj.id, { rotation: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
          {obj.deviceData.id === 'arrow_board' && (
            <div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>Arrow Board Mode</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {(['right', 'left', 'caution', 'flashing'] as ArrowBoardMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onUpdate(obj.id, { arrowBoardMode: mode })}
                    style={{
                      padding: "5px 4px", fontSize: 10, borderRadius: 4, cursor: "pointer",
                      background: (obj.arrowBoardMode ?? 'right') === mode ? COLORS.accentDim : 'transparent',
                      color: (obj.arrowBoardMode ?? 'right') === mode ? COLORS.accent : COLORS.textMuted,
                      border: (obj.arrowBoardMode ?? 'right') === mode ? `1px solid rgba(245,158,11,0.35)` : `1px solid ${COLORS.panelBorder}`,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}
                  >
                    {mode === 'right' ? '→ Right' : mode === 'left' ? '← Left' : mode === 'caution' ? '◇ Caution' : '✦ Flash'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {obj.type === "taper" && (() => {
        const t = obj as TaperObject;
        const autoLen = calcTaperLength(t.speed, t.laneWidth, t.numLanes);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Speed: {t.speed} mph
              <input type="range" min={25} max={65} step={5} value={t.speed}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => {
                  const speed = +e.target.value;
                  onUpdate(t.id, { speed, ...(!t.manualLength && { taperLength: calcTaperLength(speed, t.laneWidth, t.numLanes) }) });
                }} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Lane Width: {t.laneWidth} ft
              <input type="range" min={10} max={16} step={1} value={t.laneWidth}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => {
                  const laneWidth = +e.target.value;
                  onUpdate(t.id, { laneWidth, ...(!t.manualLength && { taperLength: calcTaperLength(t.speed, laneWidth, t.numLanes) }) });
                }} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Lanes Closed: {t.numLanes}
              <input type="range" min={1} max={2} step={1} value={t.numLanes}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => {
                  const numLanes = +e.target.value;
                  onUpdate(t.id, { numLanes, ...(!t.manualLength && { taperLength: calcTaperLength(t.speed, t.laneWidth, numLanes) }) });
                }} />
            </label>
            <div style={{ fontSize: 11, color: COLORS.accent, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 4, padding: "4px 8px" }}>
              MUTCD L = {autoLen} ft
            </div>
            <label style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={t.manualLength}
                onChange={(e) => onUpdate(t.id, { manualLength: e.target.checked, taperLength: e.target.checked ? t.taperLength : autoLen })} />
              Manual override
            </label>
            {t.manualLength && (
              <label style={{ fontSize: 11, color: COLORS.textMuted }}>
                Length: {t.taperLength} ft
                <input type="range" min={50} max={2000} step={10} value={t.taperLength}
                  style={{ width: "100%", accentColor: COLORS.accent }}
                  onChange={(e) => onUpdate(t.id, { taperLength: +e.target.value })} />
              </label>
            )}
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Rotation: {t.rotation}°
              <input type="range" min={0} max={360} value={t.rotation}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(t.id, { rotation: +e.target.value })} />
            </label>
            <div style={{ borderTop: `1px solid ${COLORS.panelBorder}`, paddingTop: 8, marginTop: 4 }}>
              {sectionTitle("Compliance Overlays")}
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6 }}>
                Show MUTCD Table 6H-3 advance warning sign distances on canvas
              </div>
              <button type="button"
                aria-pressed={showSpacingGuide}
                style={{ ...panelBtnStyle(showSpacingGuide), background: showSpacingGuide ? COLORS.info : undefined, color: showSpacingGuide ? '#fff' : undefined, width: '100%', marginBottom: 6 }}
                onClick={onToggleSpacingGuide}>
                {showSpacingGuide ? 'Hide Spacing Guide' : 'Show Spacing Guide'}
              </button>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6 }}>
                Show MUTCD Part 6C buffer zone between taper and first advance sign
              </div>
              <button type="button"
                aria-pressed={showBufferZone}
                style={{ ...panelBtnStyle(showBufferZone), background: showBufferZone ? 'rgba(249,115,22,0.75)' : undefined, color: showBufferZone ? '#fff' : undefined, width: '100%', marginBottom: 8 }}
                onClick={onToggleBufferZone}>
                {showBufferZone ? 'Hide Buffer Zone' : 'Show Buffer Zone'}
              </button>
            </div>
            <div style={{ borderTop: `1px solid ${COLORS.panelBorder}`, paddingTop: 8, marginTop: 4 }}>
              {sectionTitle("Auto-Channelize")}
              <label style={{ fontSize: 11, color: COLORS.textMuted }}>
                Work Zone Length: {workZoneLength} ft
                <input type="range" min={100} max={5000} step={50} value={workZoneLength}
                  style={{ width: "100%", accentColor: COLORS.accent }}
                  onChange={(e) => setWorkZoneLength(+e.target.value)} />
              </label>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6 }}>
                Places MUTCD Table 6H-3 advance warning signs + downstream taper
              </div>
              <button type="button"
                style={{ ...panelBtnStyle, background: COLORS.accent, color: '#fff', width: '100%' }}
                onClick={() => onAutoChannelize(t.id, workZoneLength)}>
                Auto-Channelize
              </button>
            </div>
          </div>
        );
      })()}

      {obj.type === "turn_lane" && (() => {
        const tl = obj as TurnLaneObject;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sectionTitle("Turn Lane")}
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>Side</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["right", "left"] as const).map((s) => (
                <button key={s} onClick={() => onUpdate(tl.id, { side: s })}
                  style={{ ...panelBtnStyle(tl.side === s), flex: 1, textTransform: "capitalize" }}>
                  {s === "right" ? "Right" : "Left"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>Turn Direction</div>
            <div style={{ display: "flex", gap: 4 }}>
              {([["left", "← Left"], ["thru", "↑ Thru"], ["right", "→ Right"]] as const).map(([dir, label]) => (
                <button key={dir} onClick={() => onUpdate(tl.id, { turnDir: dir })}
                  style={{ ...panelBtnStyle(tl.turnDir === dir), flex: 1, fontSize: 9 }}>
                  {label}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Taper Length: {tl.taperLength}px
              <input type="range" min={20} max={200} step={5} value={tl.taperLength}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(tl.id, { taperLength: +e.target.value })} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Run Length: {tl.runLength}px
              <input type="range" min={40} max={300} step={5} value={tl.runLength}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(tl.id, { runLength: +e.target.value })} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Lane Width: {tl.laneWidth}px
              <input type="range" min={10} max={50} step={1} value={tl.laneWidth}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(tl.id, { laneWidth: +e.target.value })} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Rotation: {tl.rotation}°
              <input type="range" min={0} max={360} value={tl.rotation}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(tl.id, { rotation: +e.target.value })} />
            </label>
          </div>
        );
      })()}

      {obj.type === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={obj.text} onChange={(e) => onUpdate(obj.id, { text: e.target.value })}
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "6px 8px", borderRadius: 4, fontSize: 12 }} />
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Font Size: {obj.fontSize || 14}
            <input type="range" min="8" max="48" value={obj.fontSize || 14}
              onChange={(e) => onUpdate(obj.id, { fontSize: +e.target.value })}
              style={{ width: "100%", accentColor: COLORS.accent }} />
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={obj.bold || false}
              onChange={(e) => onUpdate(obj.id, { bold: e.target.checked })} />
            Bold
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Color
            <input type="color" value={obj.color || "#ffffff"}
              onChange={(e) => onUpdate(obj.id, { color: e.target.value })}
              style={{ width: "100%", height: 24, cursor: "pointer" }} />
          </label>
        </div>
      )}

      {isMultiPointRoad(obj) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {obj.type === "polyline_road"
              ? `Polyline — ${obj.points.length} points`
              : obj.type === "cubic_bezier_road"
              ? "Cubic Bézier curve — drag handles to reshape"
              : "Quadratic Bézier curve"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {obj.roadType} · {obj.lanes} lanes · {obj.width}px wide
          </div>
        </div>
      )}

      {obj.type === "road" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sectionTitle("Shoulder & Sidewalk")}
          <label style={{ fontSize: 11, color: COLORS.textMuted }}>
            Shoulder Width: {obj.shoulderWidth ? `${obj.shoulderWidth}px` : 'None'}
            <input type="range" min={0} max={30} step={1} value={obj.shoulderWidth ?? 0}
              style={{ width: "100%", accentColor: COLORS.accent }}
              onChange={(e) => onUpdate(obj.id, { shoulderWidth: +e.target.value })} />
          </label>
          <label style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>
            Sidewalk
            <select
              value={obj.sidewalkSide ?? 'none'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'none') {
                  onUpdate(obj.id, { sidewalkSide: undefined, sidewalkWidth: 0 });
                } else {
                  onUpdate(obj.id, { sidewalkSide: val, sidewalkWidth: obj.sidewalkWidth || 12 });
                }
              }}
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11 }}
            >
              <option value="none">None</option>
              <option value="both">Both sides</option>
              <option value="left">Left only</option>
              <option value="right">Right only</option>
            </select>
          </label>
          {obj.sidewalkSide && (obj.sidewalkWidth ?? 0) > 0 && (
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Sidewalk Width: {obj.sidewalkWidth}px
              <input type="range" min={8} max={24} step={1} value={obj.sidewalkWidth ?? 12}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(obj.id, { sidewalkWidth: +e.target.value })} />
            </label>
          )}
        </div>
      )}

      {obj.type === "lane_mask" && (() => {
        const m = obj as LaneMaskObject;
        const colorToHex = (c: string): string => {
          const m2 = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m2) {
            return "#" + [m2[1], m2[2], m2[3]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
          }
          return c.startsWith("#") ? c.slice(0, 7) : "#ef4444";
        };
        const hexToRgba = (hex: string, alpha = 0.5): string => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r},${g},${b},${alpha})`;
        };
        const alphaMatch = m.color.match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
        const currentAlpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0.5;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Lane Width: {m.laneWidth}px
              <input type="range" min={10} max={60} step={1} value={m.laneWidth}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(m.id, { laneWidth: +e.target.value })} />
            </label>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>Style</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["hatch", "solid"] as const).map((s) => (
                <button key={s} onClick={() => onUpdate(m.id, { style: s })}
                  style={{ ...panelBtnStyle(m.style === s), flex: 1, textTransform: "capitalize" }}>
                  {s === "hatch" ? "▧ Hatch" : "█ Solid"}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Color
              <input type="color" value={colorToHex(m.color)}
                onChange={(e) => onUpdate(m.id, { color: hexToRgba(e.target.value, currentAlpha) })}
                style={{ width: "100%", height: 24, cursor: "pointer", marginTop: 4 }} />
            </label>
          </div>
        );
      })()}

      {obj.type === "crosswalk" && (() => {
        const cw = obj as CrosswalkObject;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Depth: {cw.depth}px
              <input type="range" min={10} max={60} step={1} value={cw.depth}
                style={{ width: "100%", accentColor: COLORS.accent }}
                onChange={(e) => onUpdate(cw.id, { depth: +e.target.value })} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Stripes: {cw.stripeCount}
              <input type="number" min={3} max={12} step={1} value={cw.stripeCount}
                style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                onChange={(e) => { const v = parseInt(e.target.value); if (v >= 3 && v <= 12) onUpdate(cw.id, { stripeCount: v }); }} />
            </label>
            <label style={{ fontSize: 11, color: COLORS.textMuted }}>
              Stripe Color
              <input type="color" value={cw.stripeColor}
                onChange={(e) => onUpdate(cw.id, { stripeColor: e.target.value })}
                style={{ width: "100%", height: 24, cursor: "pointer", marginTop: 4 }} />
            </label>
          </div>
        );
      })()}

      {isPointObject(obj) && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {(["x", "y"] as const).map((axis) => (
            <label key={axis} style={{ flex: 1, fontSize: 11, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 2 }}>
              {axis.toUpperCase()}
              <input type="number" step="any" value={obj[axis]}
                onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onUpdate(obj.id, { [axis]: v }); }}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: "100%", outline: "none" }} />
            </label>
          ))}
        </div>
      )}

      {isLineObject(obj) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {([ ["x1", "y1"], ["x2", "y2"] ] as const).map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex", gap: 6 }}>
              {row.map((k) => (
                <label key={k} style={{ flex: 1, fontSize: 11, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 2 }}>
                  {k.toUpperCase()}
                  <input type="number" step="any" value={obj[k]}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onUpdate(obj.id, { [k]: v }); }}
                    style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.text, padding: "4px 6px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: "100%", outline: "none" }} />
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Layer order</div>
        <div style={{ display: "flex", gap: 4 }}>
          {([
            ["▲▲", "front", "Bring to Front"],
            ["▲",  "forward",  "Bring Forward"],
            ["▼",  "backward", "Send Backward"],
            ["▼▼", "back",   "Send to Back"],
          ] as [string, "front" | "forward" | "backward" | "back", string][]).map(([icon, dir, title]) => (
            <button key={dir} title={title} aria-label={title} onClick={() => onReorder(obj.id, dir)}
              style={{ flex: 1, padding: "4px 0", background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textMuted, borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onDelete(obj.id)}
        style={{
          marginTop: 10, width: "100%", padding: "6px 0",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          color: COLORS.danger, borderRadius: 6, cursor: "pointer",
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        Delete Object
      </button>
    </div>
  );
}
