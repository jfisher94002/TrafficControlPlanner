import { useState, useRef, useEffect, useMemo } from 'react';
import type { SignData, SignShape } from '../../../types';
import { uid } from '../../../utils';
import { COLORS } from '../../../features/tcp/constants';
import { SIGN_SHAPES } from '../../../features/tcp/tcpCatalog';
import { drawSign } from '../../../shapes/drawSign';
import { sectionTitle } from '../../../features/tcp/panelHelpers';

interface SignEditorPanelProps {
  onUseSign: () => void;
  onSaveToLibrary: (signData: SignData) => void;
  onSignChange: (signData: SignData) => void;
}

export function SignEditorPanel({ onUseSign, onSaveToLibrary, onSignChange }: SignEditorPanelProps) {
  const [shape, setShape] = useState<SignShape>("diamond");
  const [text, setText] = useState("CUSTOM");
  const [bgColor, setBgColor] = useState("#f97316");
  const [textColor, setTextColor] = useState("#111111");
  const previewRef = useRef<HTMLCanvasElement>(null);

  const signData = useMemo(() => ({
    id: `custom_${shape}_${(text || " ").trim().toLowerCase().replace(/\s+/g, "_")}`,
    label: text || " ",
    shape,
    color: bgColor,
    textColor,
    border: "#333",
  }), [shape, text, bgColor, textColor]);

  useEffect(() => { onSignChange(signData); }, [signData, onSignChange]);

  useEffect(() => {
    const cvs = previewRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 100, 100);
    ctx.fillStyle = COLORS.canvas;
    ctx.fillRect(0, 0, 100, 100);
    drawSign(ctx, { x: 50, y: 50, signData, rotation: 0, scale: 2.2 }, false);
  }, [signData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sectionTitle("Shape")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {SIGN_SHAPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setShape(s.id as SignShape)}
            style={{
              padding: "6px 4px",
              background: shape === s.id ? COLORS.accentDim : "rgba(255,255,255,0.03)",
              border: `1px solid ${shape === s.id ? COLORS.accent : COLORS.panelBorder}`,
              borderRadius: 4,
              color: shape === s.id ? COLORS.accent : COLORS.textMuted,
              cursor: "pointer", fontSize: 10, fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{s.preview}</span>
            <span style={{ fontSize: 8 }}>{s.label}</span>
          </button>
        ))}
      </div>

      {sectionTitle("Sign Text")}
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 14))}
        style={{
          background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`,
          color: COLORS.text, padding: "6px 8px", borderRadius: 4,
          fontSize: 12, fontFamily: "inherit", outline: "none",
        }}
        placeholder="SIGN TEXT"
      />

      {sectionTitle("Colors")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 10, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 4 }}>
          Background
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
            style={{ width: "100%", height: 28, cursor: "pointer", border: "none", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 10, color: COLORS.textMuted, display: "flex", flexDirection: "column", gap: 4 }}>
          Text Color
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
            style={{ width: "100%", height: 28, cursor: "pointer", border: "none", borderRadius: 4 }} />
        </label>
      </div>

      {sectionTitle("Preview")}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <canvas ref={previewRef} width={100} height={100}
          style={{ borderRadius: 6, border: `1px solid ${COLORS.panelBorder}` }} />
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onUseSign}
          style={{
            flex: 1, padding: "8px 0", background: COLORS.accentDim,
            border: `1px solid ${COLORS.accent}`, borderRadius: 6,
            color: COLORS.accent, cursor: "pointer", fontSize: 11,
            fontFamily: "inherit", fontWeight: 600, letterSpacing: 0.5,
          }}
        >
          ✓ Place
        </button>
        <button
          onClick={() => onSaveToLibrary({ ...signData, id: "custom_" + uid() })}
          style={{
            flex: 1, padding: "8px 0", background: "transparent",
            border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6,
            color: COLORS.textMuted, cursor: "pointer", fontSize: 11,
            fontFamily: "inherit", fontWeight: 600, letterSpacing: 0.5,
          }}
        >
          + Save
        </button>
      </div>
    </div>
  );
}
