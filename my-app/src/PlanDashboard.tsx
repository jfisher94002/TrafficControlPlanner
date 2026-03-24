import React, { useEffect, useState, useCallback } from 'react'
import { CloudPlanMeta, listCloudPlans, loadPlanFromCloud, deletePlanFromCloud } from './planStorage'

interface PlanDashboardProps {
  userId: string
  onOpen: (plan: Record<string, unknown>) => void
  onClose: () => void
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#1a1d27', border: '1px solid #2d3048', borderRadius: 8,
    width: 540, maxWidth: '90vw', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid #2d3048', flexShrink: 0,
  },
  title: { fontSize: 13, fontWeight: 700, color: '#f59e0b', letterSpacing: 1 },
  closeBtn: {
    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
    fontSize: 18, lineHeight: 1, padding: 4,
  },
  body: { flex: 1, overflowY: 'auto', padding: '12px 20px' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    borderRadius: 6, marginBottom: 4, background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2d3048',
  },
  planName: { flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' },
  btn: {
    fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'inherit', border: '1px solid',
  },
  openBtn: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' },
  deleteBtn: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' },
  empty: { textAlign: 'center', color: '#64748b', fontSize: 12, padding: '40px 0' },
  error: { color: '#ef4444', fontSize: 11, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 4, marginBottom: 8 },
  footer: { padding: '12px 20px', borderTop: '1px solid #2d3048', flexShrink: 0, fontSize: 10, color: '#64748b' },
}

export default function PlanDashboard({ userId, onOpen, onClose }: PlanDashboardProps) {
  const [plans, setPlans] = useState<CloudPlanMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlans(await listCloudPlans(userId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list plans')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const handleOpen = async (plan: CloudPlanMeta) => {
    setOpening(plan.path)
    setError(null)
    try {
      const data = await loadPlanFromCloud(plan.path)
      setOpening(null)
      onOpen(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan')
      setOpening(null)
    }
  }

  const handleDelete = async (plan: CloudPlanMeta) => {
    if (!confirm(`Delete "${plan.name}" from cloud? This cannot be undone.`)) return
    setDeleting(plan.path)
    setError(null)
    try {
      await deletePlanFromCloud(plan.path)
      setPlans(prev => prev.filter(p => p.path !== plan.path))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete plan')
    } finally {
      setDeleting(null)
    }
  }

  const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div data-testid="plan-dashboard-overlay" style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div data-testid="plan-dashboard" style={S.modal} role="dialog" aria-modal="true" aria-label="Cloud Plans">
        <div style={S.header}>
          <span style={S.title}>☁ CLOUD PLANS</span>
          <button data-testid="dashboard-close" style={S.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={S.body}>
          {error && <div data-testid="dashboard-error" style={S.error}>{error}</div>}

          {loading && <div style={S.empty}>Loading…</div>}

          {!loading && plans.length === 0 && (
            <div data-testid="dashboard-empty" style={S.empty}>No saved plans yet.<br />Use ☁ Save to save your first plan.</div>
          )}

          {!loading && plans.map(plan => (
            <div key={plan.path} data-testid="dashboard-plan-row" style={S.row}>
              <div style={S.planName} title={plan.name}>{plan.name}</div>
              <span style={S.meta}>{fmt(plan.lastModified)}</span>
              <button
                data-testid="dashboard-open-btn"
                style={{ ...S.btn, ...S.openBtn }}
                disabled={opening === plan.path}
                onClick={() => handleOpen(plan)}
              >
                {opening === plan.path ? '…' : 'Open'}
              </button>
              <button
                data-testid="dashboard-delete-btn"
                style={{ ...S.btn, ...S.deleteBtn }}
                disabled={deleting === plan.path}
                onClick={() => handleDelete(plan)}
              >
                {deleting === plan.path ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>

        <div style={S.footer}>
          {plans.length > 0 && `${plans.length} plan${plans.length !== 1 ? 's' : ''} saved`}
        </div>
      </div>
    </div>
  )
}
