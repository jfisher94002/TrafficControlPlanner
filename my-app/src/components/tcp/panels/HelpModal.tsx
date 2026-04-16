import { useRef, useEffect } from 'react';
import { COLORS } from '../../../features/tcp/constants';
import { TOOLS } from '../../../features/tcp/tcpCatalog';

const KEYBOARD_SHORTCUTS: { key: string; description: string }[] = [
  { key: "V", description: "Select tool" },
  { key: "H", description: "Pan tool" },
  { key: "R", description: "Road tool" },
  { key: "S", description: "Sign tool" },
  { key: "D", description: "Device tool" },
  { key: "Z", description: "Work Zone tool" },
  { key: "T", description: "Text tool" },
  { key: "U", description: "Measure tool" },
  { key: "A", description: "Arrow tool" },
  { key: "P", description: "Taper tool" },
  { key: "M", description: "Lane Mask tool" },
  { key: "C", description: "Crosswalk tool" },
  { key: "L", description: "Turn Lane tool" },
  { key: "X", description: "Erase tool" },
  { key: "?", description: "Toggle this help panel" },
  { key: "Ctrl+Z", description: "Undo" },
  { key: "Ctrl+Shift+Z", description: "Redo" },
  { key: "Ctrl+C", description: "Copy selected object" },
  { key: "Ctrl+V", description: "Paste copied object" },
  { key: "Del / Bksp", description: "Delete selected object" },
  { key: "Enter / DblClick", description: "Finish polyline" },
];

interface HelpModalProps { onClose: () => void; }

export function HelpModal({ onClose }: HelpModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    if (document.activeElement !== closeRef.current) {
      backdropRef.current?.focus();
    }
    return () => { prev?.focus(); };
  }, []);

  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    };
    document.addEventListener('keydown', onDocKeyDown, true);
    return () => document.removeEventListener('keydown', onDocKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    const el = backdropRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const focusable = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="Help"
      data-testid="help-modal"
      tabIndex={-1}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10, width: "min(680px, 100vw - 32px)", maxHeight: "80vh", overflow: "hidden",
          display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>Help — Keyboard Shortcuts &amp; Tool Guide</span>
          <button
            ref={closeRef}
            onClick={onClose}
            data-testid="help-modal-close"
            style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
            aria-label="Close help"
          >✕</button>
        </div>

        <div style={{ overflow: "auto", padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Keyboard Shortcuts</div>
            {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
              <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <kbd style={{
                  display: "inline-block", minWidth: 80, padding: "2px 6px", borderRadius: 4,
                  background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`,
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.accent,
                  textAlign: "center", flexShrink: 0,
                }}>{key}</kbd>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{description}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Tool Guide</div>
            {TOOLS.map((t) => (
              <div key={t.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13 }}>{t.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{t.label}</span>
                  <kbd style={{
                    display: "inline-block", padding: "1px 5px", borderRadius: 3,
                    background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`,
                    fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: COLORS.textDim,
                  }}>{t.shortcut}</kbd>
                </div>
                {t.helpText && (
                  <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, lineHeight: 1.5, paddingLeft: 20 }}>{t.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "10px 20px", borderTop: `1px solid ${COLORS.panelBorder}`, fontSize: 10, color: COLORS.textDim, textAlign: "center" }}>
          Press <kbd style={{ padding: "1px 5px", borderRadius: 3, background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, fontFamily: "'JetBrains Mono', monospace", color: COLORS.accent }}>?</kbd> or click the <strong style={{ color: COLORS.textMuted }}>?</strong> button in the toolbar to toggle this panel
        </div>
      </div>
    </div>
  );
}
