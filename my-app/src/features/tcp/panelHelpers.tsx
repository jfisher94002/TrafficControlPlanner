import type React from 'react';
import { COLORS } from './constants';

export const sectionTitle = (text: string) => (
  <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, marginTop: 12, fontFamily: "'JetBrains Mono', monospace" }}>
    {text}
  </div>
);

export const panelBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  background: active ? COLORS.accentDim : "transparent",
  color: active ? COLORS.accent : COLORS.textMuted,
  border: active ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.panelBorder}`,
  borderRadius: 5,
  cursor: "pointer",
  transition: "all 0.15s",
});
