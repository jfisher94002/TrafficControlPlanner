import type { QCIssue } from '../../../qcRules';

export function getQCBadgeColor(issues: QCIssue[]): string | null {
  if (issues.some(i => i.severity === "error"))   return "#ef4444";
  if (issues.some(i => i.severity === "warning")) return "#f59e0b";
  return null;
}

export function QCPanel({ issues }: { issues: QCIssue[] }) {
  const SEV_COLOR = { error: "#ef4444", warning: "#f59e0b", info: "#64748b" } as const;
  const SEV_ICON  = { error: "✕", warning: "⚠", info: "ℹ" } as const;
  const errorCount   = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const infoCount    = issues.filter(i => i.severity === "info").length;
  return (
    <div data-testid="qc-panel" style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      {issues.length === 0 ? (
        <div style={{ textAlign: "center", color: "#22c55e", fontSize: 11, padding: "24px 0" }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>✓</div>
          No issues found
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
            {errorCount} error{errorCount !== 1 ? "s" : ""},{" "}
            {warningCount} warning{warningCount !== 1 ? "s" : ""}
            {infoCount > 0 && `, ${infoCount} info`}
          </div>
          {issues.map(issue => (
            <div key={issue.id} data-testid={`qc-issue-${issue.severity}`}
              style={{ padding: "8px 10px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: `1px solid ${SEV_COLOR[issue.severity]}33`, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: SEV_COLOR[issue.severity], fontSize: 12, flexShrink: 0, marginTop: 1 }}>{SEV_ICON[issue.severity]}</span>
              <span style={{ fontSize: 10, color: "#cbd5e1", lineHeight: 1.4 }}>{issue.message}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
