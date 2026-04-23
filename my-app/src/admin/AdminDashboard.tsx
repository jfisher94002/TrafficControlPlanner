import { useEffect, useState, useCallback } from 'react'

const API_BASE = (import.meta.env.VITE_EXPORT_API_BASE ?? '').replace(/\/$/, '')

interface CognitoUser {
  sub: string
  email: string
  username: string
  status: string
  created: string
  enabled: boolean
}

interface PlanMeta {
  key: string
  planId: string
  size: number
  lastModified: string
}

interface AdminDashboardProps {
  accessToken: string
  onSignOut: () => void
}

function useAdminFetch<T>(path: string, accessToken: string) {
  const [data, setData]     = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [path, accessToken])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}

function UserPlans({ sub, accessToken }: { sub: string; accessToken: string }) {
  const { data, loading, error } = useAdminFetch<{ plans: PlanMeta[] }>(
    `/admin/users/${sub}/plans`,
    accessToken,
  )

  if (loading) return <p style={styles.muted}>Loading plans…</p>
  if (error)   return <p style={styles.err}>Error: {error}</p>

  const plans = data?.plans ?? []
  if (plans.length === 0) return <p style={styles.muted}>No plans.</p>

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Plan ID</th>
          <th style={styles.th}>Size</th>
          <th style={styles.th}>Last Modified</th>
        </tr>
      </thead>
      <tbody>
        {plans.map(p => (
          <tr key={p.planId}>
            <td style={styles.td}><code>{p.planId}</code></td>
            <td style={styles.td}>{(p.size / 1024).toFixed(1)} KB</td>
            <td style={styles.td}>{new Date(p.lastModified).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AdminDashboard({ accessToken, onSignOut }: AdminDashboardProps) {
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const { data, loading, error, reload } = useAdminFetch<{ users: CognitoUser[] }>(
    '/admin/users',
    accessToken,
  )

  const users = data?.users ?? []

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>TCP Admin</h1>
        <div style={styles.headerRight}>
          <span style={styles.muted}>{users.length} user{users.length !== 1 ? 's' : ''}</span>
          <button style={styles.btn} onClick={reload}>Refresh</button>
          <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {loading && <p style={styles.muted}>Loading users…</p>}
      {error   && <p style={styles.err}>Error: {error}</p>}

      {!loading && !error && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Created</th>
              <th style={styles.th}>Plans</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <>
                <tr
                  key={u.sub}
                  style={{ ...styles.row, opacity: u.enabled ? 1 : 0.5 }}
                  onClick={() => setExpandedSub(expandedSub === u.sub ? null : u.sub)}
                >
                  <td style={styles.td}>
                    <span style={styles.email}>{u.email || u.username}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(u.status === 'CONFIRMED' ? styles.badgeGreen : styles.badgeYellow) }}>
                      {u.status}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(u.created).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    <span style={styles.expandIcon}>{expandedSub === u.sub ? '▾' : '▸'} plans</span>
                  </td>
                </tr>
                {expandedSub === u.sub && (
                  <tr key={`${u.sub}-plans`}>
                    <td colSpan={4} style={styles.planCell}>
                      <UserPlans sub={u.sub} accessToken={accessToken} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Inline styles (no extra CSS deps) ───────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#111',
    color: '#e5e7eb',
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '0 0 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #2d2d2d',
    background: '#1a1a1a',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#f97316',
  },
  muted: {
    color: '#6b7280',
    padding: '8px 24px',
    margin: 0,
  },
  err: {
    color: '#ef4444',
    padding: '8px 24px',
    margin: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '16px 0',
  },
  th: {
    textAlign: 'left',
    padding: '8px 24px',
    background: '#1a1a1a',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #2d2d2d',
  },
  td: {
    padding: '10px 24px',
    borderBottom: '1px solid #1f1f1f',
    fontSize: 14,
    verticalAlign: 'middle',
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  email: {
    fontWeight: 500,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.03em',
  },
  badgeGreen: {
    background: 'rgba(34,197,94,0.15)',
    color: '#4ade80',
  },
  badgeYellow: {
    background: 'rgba(234,179,8,0.15)',
    color: '#facc15',
  },
  expandIcon: {
    color: '#6b7280',
    fontSize: 12,
  },
  planCell: {
    padding: '0 24px 16px 48px',
    background: '#161616',
    borderBottom: '1px solid #2d2d2d',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #374151',
    background: '#1f2937',
    color: '#e5e7eb',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnDanger: {
    borderColor: '#7f1d1d',
    background: '#1c0a0a',
    color: '#fca5a5',
  },
}
