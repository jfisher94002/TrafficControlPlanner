import { COLORS } from '../../../features/tcp/constants';
import type { ToolDef } from '../../../types';

interface ToolButtonProps { tool: ToolDef; active: boolean; onClick: () => void; }
export function ToolButton({ tool, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
      data-testid={`tool-${tool.id}`}
      aria-pressed={active}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, borderRadius: 8,
        border: active ? `2px solid ${COLORS.accent}` : "1px solid transparent",
        background: active ? COLORS.accentDim : "transparent",
        color: active ? COLORS.accent : COLORS.textMuted,
        cursor: "pointer", fontSize: 18, transition: "all 0.15s", position: "relative",
      }}
    >
      <span>{tool.icon}</span>
      <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: 7, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
        {tool.shortcut}
      </span>
    </button>
  );
}
