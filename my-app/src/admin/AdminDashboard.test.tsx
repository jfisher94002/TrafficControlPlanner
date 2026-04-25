import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminDashboard } from './AdminDashboard'

const fetchMock = vi.fn<typeof fetch>()

const usersPayload = {
  users: [
    {
      sub: 'user/with special&chars',
      email: 'driver@example.com',
      username: 'driver',
      status: 'CONFIRMED',
      created: '2026-01-02T00:00:00.000Z',
      enabled: true,
    },
  ],
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads users with a bearer token and refreshes the admin user list', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(usersPayload))
      .mockResolvedValueOnce(jsonResponse({ users: [] }))

    const user = userEvent.setup()
    render(<AdminDashboard accessToken="admin-token" onSignOut={vi.fn()} />)

    expect(await screen.findByText('driver@example.com')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/admin/users', {
      headers: { Authorization: 'Bearer admin-token' },
    })

    await user.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/admin/users', {
      headers: { Authorization: 'Bearer admin-token' },
    })
    await waitFor(() => expect(screen.getByText('0 users')).toBeInTheDocument())
  })

  it('shows FastAPI error details from failed admin user requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Admin group required' }, { status: 403 }))

    render(<AdminDashboard accessToken="not-admin" onSignOut={vi.fn()} />)

    expect(await screen.findByText('Error: Admin group required')).toBeInTheDocument()
  })

  it('falls back to the HTTP status when an error response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream failed', { status: 502 }))

    render(<AdminDashboard accessToken="admin-token" onSignOut={vi.fn()} />)

    expect(await screen.findByText('Error: HTTP 502')).toBeInTheDocument()
  })

  it('expands a user row and requests plans with the encoded Cognito sub', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(usersPayload))
      .mockResolvedValueOnce(jsonResponse({
        plans: [
          {
            key: 'plans/user/with special&chars/plan-123.tcp.json',
            planId: 'plan-123',
            size: 1536,
            lastModified: '2026-02-03T04:05:06.000Z',
          },
        ],
      }))

    const user = userEvent.setup()
    render(<AdminDashboard accessToken="admin-token" onSignOut={vi.fn()} />)

    const row = (await screen.findByText('driver@example.com')).closest('tr')
    expect(row).not.toBeNull()
    await user.click(row!)

    expect(await screen.findByText('plan-123')).toBeInTheDocument()
    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/admin/users/user%2Fwith%20special%26chars/plans',
      { headers: { Authorization: 'Bearer admin-token' } },
    )
  })

  it('collapses an expanded user without refetching plans', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(usersPayload))
      .mockResolvedValueOnce(jsonResponse({ plans: [] }))

    const user = userEvent.setup()
    render(<AdminDashboard accessToken="admin-token" onSignOut={vi.fn()} />)

    const row = (await screen.findByText('driver@example.com')).closest('tr')
    expect(row).not.toBeNull()

    await user.click(row!)
    const expandedRow = await screen.findByText('No plans.')
    expect(expandedRow).toBeInTheDocument()

    await user.click(row!)

    await waitFor(() => expect(screen.queryByText('No plans.')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(within(row!).getByText('▸ plans')).toBeInTheDocument()
  })
})
