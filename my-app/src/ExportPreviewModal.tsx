import React, { useRef, useEffect } from 'react'
import type { PlanMeta } from './types'
import type { QCIssue } from './qcRules'

interface ExportPreviewModalProps {
  canvasDataUrl: string
  planTitle: string
  planMeta: PlanMeta
  planCreatedAt: string
  qcIssues: QCIssue[]
  onConfirm: () => Promise<void>
  onClose: () => void
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#1a1d27', border: '1px solid #2d3048', borderRadius: 8,
    width: 720, maxWidth: '95vw', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0',
    outline: 'none',
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
  body: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  sectionLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  // PDF page mockup
  page: {
    background: '#fff', borderRadius: 4, overflow: 'hidden',
    border: '1px solid #2d3048', width: '100%', aspectRatio: '11/8.5',
    display: 'flex', flexDirection: 'column',
  },
  titleBlock: {
    background: '#f1f5f9', borderBottom: '1px solid #cbd5e1',
    padding: '6px 10px', flexShrink: 0, display: 'flex', gap: 8,
  },
  tbCol: { display: 'flex', flexDirection: 'column', gap: 2 },
  tbLabel: { fontSize: 8, color: '#94a3b8', fontFamily: 'inherit' },
  tbValue: { fontSize: 9, color: '#1e293b', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  imageArea: { flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' },
  legendBar: {
    background: '#f1f5f9', borderTop: '1px solid #cbd5e1',
    padding: '4px 10px', flexShrink: 0,
    fontSize: 8, color: '#64748b', fontFamily: 'inherit',
  },
  // QC section
  qcRow: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '6px 10px', borderRadius: 4,
    background: 'rgba(255,255,255,0.03)', border: '1px solid #2d3048', marginBottom: 4,
  },
  footer: {
    padding: '14px 20px', borderTop: '1px solid #2d3048', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
  },
  cancelBtn: {
    fontSize: 12, padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'inherit', border: '1px solid #2d3048',
    background: 'transparent', color: '#94a3b8',
  },
  exportBtn: {
    fontSize: 12, padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'inherit', border: '1px solid rgba(245,158,11,0.4)',
    background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600,
  },
}

const SEV_COLOR = { error: '#ef4444', warning: '#f59e0b', info: '#64748b' } as const
const SEV_ICON  = { error: '✕', warning: '⚠', info: 'ℹ' } as const

export default function ExportPreviewModal({
  canvasDataUrl, planTitle, planMeta, planCreatedAt, qcIssues, onConfirm, onClose,
}: ExportPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  useEffect(() => { modalRef.current?.focus() }, [])

  const dateStr = (() => {
    if (!planCreatedAt) return '—'
    const d = new Date(planCreatedAt)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  })()

  const errors   = qcIssues.filter(i => i.severity === 'error')
  const warnings = qcIssues.filter(i => i.severity === 'warning')
  const visibleIssues = qcIssues.filter(i => i.severity !== 'info')

  return (
    <div data-testid="export-preview-overlay" style={S.overlay} onClick={onClose}>
      <div
        data-testid="export-preview-modal"
        ref={modalRef}
        style={S.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-preview-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      >
        <div style={S.header}>
          <span id="export-preview-title" style={S.title}>↓ PDF EXPORT PREVIEW</span>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close export preview">✕</button>
        </div>

        <div style={S.body}>
          {/* PDF page mockup */}
          <div>
            <div style={S.sectionLabel}>Page Layout (Landscape Letter)</div>
            <div style={S.page}>
              {/* Title block */}
              <div style={S.titleBlock}>
                <div style={{ ...S.tbCol, flex: 3 }}>
                  <span style={S.tbLabel}>Plan Name</span>
                  <span style={S.tbValue}>{planTitle || 'Untitled Traffic Control Plan'}</span>
                </div>
                <div style={{ ...S.tbCol, flex: 2 }}>
                  <span style={S.tbLabel}>Client</span>
                  <span style={S.tbValue}>{planMeta.client || '—'}</span>
                </div>
                <div style={{ ...S.tbCol, flex: 2 }}>
                  <span style={S.tbLabel}>Location</span>
                  <span style={S.tbValue}>{planMeta.location || '—'}</span>
                </div>
                <div style={{ ...S.tbCol, flex: 1 }}>
                  <span style={S.tbLabel}>Proj #</span>
                  <span style={S.tbValue}>{planMeta.projectNumber || '—'}</span>
                </div>
                <div style={{ ...S.tbCol, flex: 1 }}>
                  <span style={S.tbLabel}>Date</span>
                  <span style={S.tbValue}>{dateStr}</span>
                </div>
              </div>
              {/* Canvas image */}
              <div style={S.imageArea}>
                <img
                  data-testid="export-preview-image"
                  src={canvasDataUrl}
                  alt="Plan canvas preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
              {/* Legend bar */}
              <div style={S.legendBar}>Legend — signs and devices will appear here</div>
            </div>
          </div>

          {/* QC summary */}
          <div>
            <div style={S.sectionLabel}>
              QC Check
              {errors.length > 0 && <span style={{ color: '#ef4444', marginLeft: 8 }}>{errors.length} error{errors.length !== 1 ? 's' : ''}</span>}
              {warnings.length > 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>}
              {visibleIssues.length === 0 && <span style={{ color: '#22c55e', marginLeft: 8 }}>✓ No issues</span>}
            </div>
            {visibleIssues.length > 0 && visibleIssues.map(issue => (
              <div key={issue.id} style={S.qcRow}>
                <span style={{ color: SEV_COLOR[issue.severity], fontSize: 12, flexShrink: 0 }}>{SEV_ICON[issue.severity]}</span>
                <span style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4 }}>{issue.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={S.footer}>
          {errors.length > 0 && (
            <span style={{ fontSize: 10, color: '#ef4444', marginRight: 'auto' }}>
              Plan has errors — review QC before exporting
            </span>
          )}
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            data-testid="export-preview-confirm"
            style={S.exportBtn}
            onClick={async () => { await onConfirm(); onClose() }}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}
