import React, { useState, useRef, useEffect } from 'react'
import type { CanvasObject } from './types'
import { TEMPLATES, type TemplateDef } from './templates'
import { uid } from './utils'

interface TemplatePickerProps {
  onApply: (objects: CanvasObject[], mode: 'replace' | 'merge') => void
  onClose: () => void
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#1a1d27', border: '1px solid #2d3048', borderRadius: 8,
    width: 600, maxWidth: '92vw', maxHeight: '80vh',
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
  body: { flex: 1, overflowY: 'auto', padding: '12px 20px' },
  card: {
    padding: '12px 16px', borderRadius: 6, marginBottom: 8,
    background: 'rgba(255,255,255,0.03)', border: '1px solid #2d3048',
  },
  cardRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardName: { fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  cardMeta: { fontSize: 10, color: '#64748b' },
  useBtn: {
    fontSize: 11, padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'inherit', border: '1px solid rgba(245,158,11,0.3)',
    background: 'rgba(245,158,11,0.12)', color: '#f59e0b', whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  footer: {
    padding: '12px 20px', borderTop: '1px solid #2d3048', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 11, color: '#64748b',
  },
  modeToggle: { display: 'flex', alignItems: 'center', gap: 8 },
  warning: { fontSize: 10, color: '#f97316' },
}

function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'inherit', border: '1px solid',
    background: active ? 'rgba(245,158,11,0.15)' : 'transparent',
    color: active ? '#f59e0b' : '#64748b',
    borderColor: active ? 'rgba(245,158,11,0.35)' : '#2d3048',
  }
}

function objectSummary(objects: CanvasObject[]): string {
  const roads   = objects.filter(o => o.type === 'road' || o.type === 'polyline_road' || o.type === 'curve_road' || o.type === 'cubic_bezier_road').length
  const signs   = objects.filter(o => o.type === 'sign').length
  const devices = objects.filter(o => o.type === 'device').length
  const parts: string[] = []
  if (roads)   parts.push(`${roads} road${roads > 1 ? 's' : ''}`)
  if (signs)   parts.push(`${signs} sign${signs > 1 ? 's' : ''}`)
  if (devices) parts.push(`${devices} device${devices > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

// Deep-clone a CanvasObject so nested fields (signData, deviceData, points)
// are independent copies — prevents template mutation across applies.
function cloneTemplateObject(o: CanvasObject): CanvasObject {
  const base = { ...o, id: uid() } as CanvasObject & Record<string, unknown>
  if ('signData'   in o && o.signData)   base.signData   = { ...o.signData }
  if ('deviceData' in o && o.deviceData) base.deviceData = { ...o.deviceData }
  if ('points'     in o && Array.isArray(o.points)) base.points = o.points.map((p: { x: number; y: number }) => ({ ...p }))
  return base as CanvasObject
}

export default function TemplatePicker({ onApply, onClose }: TemplatePickerProps) {
  const [mode, setMode] = useState<'replace' | 'merge'>('replace')
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  const handleUse = (tpl: TemplateDef) => {
    onApply(tpl.objects.map(cloneTemplateObject), mode)
    onClose()
  }

  return (
    <div data-testid="template-picker-overlay" style={S.overlay} onClick={onClose}>
      <div
        data-testid="template-picker"
        ref={modalRef}
        style={S.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      >
        <div style={S.header}>
          <span id="template-picker-title" style={S.title}>◆ TEMPLATES</span>
          <button style={S.closeBtn} onClick={onClose} title="Close" aria-label="Close template picker">✕</button>
        </div>

        <div style={S.body}>
          {TEMPLATES.map(tpl => (
            <div key={tpl.id} style={S.card}>
              <div style={S.cardRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.cardName}>{tpl.name}</div>
                  <div style={S.cardDesc}>{tpl.description}</div>
                  <div style={S.cardMeta}>{objectSummary(tpl.objects)}</div>
                </div>
                <button
                  data-testid={`template-use-btn-${tpl.id}`}
                  style={S.useBtn}
                  onClick={() => handleUse(tpl)}
                >
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={S.footer}>
          <div style={S.modeToggle}>
            <span>Load mode:</span>
            <button style={modeBtnStyle(mode === 'replace')} onClick={() => setMode('replace')}>Replace</button>
            <button style={modeBtnStyle(mode === 'merge')}   onClick={() => setMode('merge')}>Merge</button>
          </div>
          {mode === 'replace' && <span style={S.warning}>Replaces current canvas</span>}
        </div>
      </div>
    </div>
  )
}
