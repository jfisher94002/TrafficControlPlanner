import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// vi.mock is hoisted — use vi.hoisted() for variables referenced inside factories
const { mockAwsExports, mockAmplifySignOut, mockHubUnsubscribe, mockGetCurrentUser } = vi.hoisted(() => ({
  mockAwsExports: {
    aws_user_pools_id: '',
    aws_user_pools_web_client_id: '',
    aws_cognito_identity_pool_id: '',
    aws_user_files_s3_bucket: '',
  },
  mockAmplifySignOut: vi.fn().mockResolvedValue(undefined),
  mockHubUnsubscribe: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}))

vi.mock('aws-amplify', () => ({ Amplify: { configure: vi.fn() } }))

vi.mock('aws-amplify/auth', () => ({
  signUp: vi.fn(),
  signOut: mockAmplifySignOut,
  getCurrentUser: mockGetCurrentUser,
}))

vi.mock('aws-amplify/utils', () => ({
  Hub: { listen: vi.fn(() => mockHubUnsubscribe) },
}))

vi.mock('./aws-exports', () => ({ default: mockAwsExports }))

vi.mock('@aws-amplify/ui-react', () => ({
  Authenticator: ({ children }: { children: (ctx: unknown) => React.ReactNode }) =>
    children({ user: null, signOut: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createTheme: vi.fn(() => ({})),
}))

vi.mock('./traffic-control-planner', () => ({
  default: ({
    userId,
    userEmail,
    onSignOut,
    onRequestSignIn,
  }: {
    userId?: string | null
    userEmail?: string | null
    onSignOut?: () => void
    onRequestSignIn?: () => void
  }) => (
    <div data-testid="planner">
      <span data-testid="prop-userId">{userId ?? 'null'}</span>
      <span data-testid="prop-userEmail">{userEmail ?? 'null'}</span>
      {onSignOut && <button data-testid="sign-out-btn" onClick={onSignOut}>Sign Out</button>}
      {onRequestSignIn && <button data-testid="request-sign-in-btn" onClick={onRequestSignIn}>Export PDF</button>}
    </div>
  ),
}))

vi.mock('./auth/SignInModal', () => ({
  SignInModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="sign-in-modal"><button onClick={onClose}>Close</button></div> : null,
}))

import App from './App'
import { Hub } from 'aws-amplify/utils'

describe('App — auth disabled (no Cognito config)', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockRejectedValue(new Error('not signed in'))
  })

  afterEach(() => { vi.clearAllMocks() })

  it('renders the planner without auth', () => {
    render(<App />)
    expect(screen.getByTestId('planner')).toBeInTheDocument()
  })

  it('passes userId=null when auth is disabled', () => {
    render(<App />)
    expect(screen.getByTestId('prop-userId').textContent).toBe('null')
  })

  it('does not render a sign-out button', () => {
    render(<App />)
    expect(screen.queryByTestId('sign-out-btn')).not.toBeInTheDocument()
  })
})

describe('App — auth enabled', () => {
  beforeEach(() => {
    mockAwsExports.aws_user_pools_id = 'us-east-1_TESTPOOL'
    mockAwsExports.aws_user_pools_web_client_id = 'testclientid123'
    mockGetCurrentUser.mockRejectedValue(new Error('not signed in'))
  })

  afterEach(() => {
    mockAwsExports.aws_user_pools_id = ''
    mockAwsExports.aws_user_pools_web_client_id = ''
    vi.clearAllMocks()
  })

  it('renders the planner immediately (no auth gate)', () => {
    render(<App />)
    expect(screen.getByTestId('planner')).toBeInTheDocument()
  })

  it('passes userId=null and userEmail=null when not signed in', () => {
    render(<App />)
    expect(screen.getByTestId('prop-userId').textContent).toBe('null')
    expect(screen.getByTestId('prop-userEmail').textContent).toBe('null')
  })

  it('restores session from getCurrentUser on mount', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'cognito-uuid-abc123',
      signInDetails: { loginId: 'user@example.com' },
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('prop-userId').textContent).toBe('cognito-uuid-abc123')
      expect(screen.getByTestId('prop-userEmail').textContent).toBe('user@example.com')
    })
  })

  it('shows sign-out button after session is restored', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'cognito-uuid-abc123',
      signInDetails: { loginId: 'user@example.com' },
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('sign-out-btn')).toBeInTheDocument()
    })
  })

  it('registers a Hub auth listener on mount', () => {
    render(<App />)
    expect(Hub.listen).toHaveBeenCalledWith('auth', expect.any(Function))
  })

  it('unsubscribes Hub listener on unmount', () => {
    const { unmount } = render(<App />)
    unmount()
    expect(mockHubUnsubscribe).toHaveBeenCalled()
  })

  it('updates userId/userEmail on Hub signedIn event', async () => {
    render(<App />)
    const hubListener = vi.mocked(Hub.listen).mock.calls[0][1] as (e: { payload: { event: string; data?: unknown } }) => void
    hubListener({
      payload: {
        event: 'signedIn',
        data: { username: 'hub-user-id', signInDetails: { loginId: 'hub@example.com' } },
      },
    })
    await waitFor(() => {
      expect(screen.getByTestId('prop-userId').textContent).toBe('hub-user-id')
      expect(screen.getByTestId('prop-userEmail').textContent).toBe('hub@example.com')
    })
  })

  it('calls amplifySignOut on tokenRefresh_failure', async () => {
    render(<App />)
    const hubListener = vi.mocked(Hub.listen).mock.calls[0][1] as (e: { payload: { event: string } }) => void
    hubListener({ payload: { event: 'tokenRefresh_failure' } })
    await waitFor(() => {
      expect(mockAmplifySignOut).toHaveBeenCalledWith({ global: true })
    })
  })

  it('passes onRequestSignIn to the planner', () => {
    render(<App />)
    expect(screen.getByTestId('request-sign-in-btn')).toBeInTheDocument()
  })

  it('shows sign-in modal when onRequestSignIn is called', async () => {
    render(<App />)
    await userEvent.click(screen.getByTestId('request-sign-in-btn'))
    expect(screen.getByTestId('sign-in-modal')).toBeInTheDocument()
  })

  it('hides sign-in modal after sign-out button is clicked inside modal', async () => {
    render(<App />)
    await userEvent.click(screen.getByTestId('request-sign-in-btn'))
    await userEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('sign-in-modal')).not.toBeInTheDocument()
  })
})
