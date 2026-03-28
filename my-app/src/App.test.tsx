import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// vi.mock is hoisted — use vi.hoisted() for variables referenced inside factories
const { mockAwsExports, mockSignOut, mockAmplifySignOut, mockHubUnsubscribe, mockUseAuthenticator } = vi.hoisted(() => ({
  mockAwsExports: {
    aws_user_pools_id: '',
    aws_user_pools_web_client_id: '',
    aws_cognito_identity_pool_id: '',
    aws_user_files_s3_bucket: '',
  },
  mockSignOut: vi.fn(),
  mockAmplifySignOut: vi.fn(),
  mockHubUnsubscribe: vi.fn(),
  mockUseAuthenticator: vi.fn(),
}))

vi.mock('aws-amplify', () => ({ Amplify: { configure: vi.fn() } }))

vi.mock('aws-amplify/auth', () => ({
  signUp: vi.fn(),
  signOut: mockAmplifySignOut,
}))

vi.mock('aws-amplify/utils', () => ({
  Hub: { listen: vi.fn(() => mockHubUnsubscribe) },
}))

vi.mock('./aws-exports', () => ({ default: mockAwsExports }))

vi.mock('@aws-amplify/ui-react', () => ({
  Authenticator: ({ children }: { children: (ctx: unknown) => React.ReactNode }) =>
    children({ user: null, signOut: mockSignOut }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createTheme: vi.fn(() => ({})),
  useAuthenticator: () => mockUseAuthenticator(),
}))

vi.mock('./traffic-control-planner', () => ({
  default: ({ userId, userEmail, onSignOut }: { userId?: string | null; userEmail?: string | null; onSignOut?: () => void }) => (
    <div data-testid="planner">
      <span data-testid="prop-userId">{userId ?? 'null'}</span>
      <span data-testid="prop-userEmail">{userEmail ?? 'null'}</span>
      {onSignOut && <button data-testid="sign-out-btn" onClick={onSignOut}>Sign Out</button>}
    </div>
  ),
}))

import App from './App'
import { Hub } from 'aws-amplify/utils'

describe('App — auth disabled (no Cognito config)', () => {
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
    mockUseAuthenticator.mockReturnValue({
      user: {
        username: 'cognito-uuid-abc123',
        signInDetails: { loginId: 'user@example.com' },
      },
      signOut: mockSignOut,
    })
  })

  afterEach(() => {
    mockAwsExports.aws_user_pools_id = ''
    mockAwsExports.aws_user_pools_web_client_id = ''
    vi.clearAllMocks()
  })

  it('passes userEmail (loginId) to the planner', () => {
    render(<App />)
    expect(screen.getByTestId('prop-userEmail').textContent).toBe('user@example.com')
  })

  it('passes userId (cognito username) to the planner', () => {
    render(<App />)
    expect(screen.getByTestId('prop-userId').textContent).toBe('cognito-uuid-abc123')
  })

  it('passes signOut as onSignOut to the planner', async () => {
    render(<App />)
    await userEvent.click(screen.getByTestId('sign-out-btn'))
    expect(mockAmplifySignOut).toHaveBeenCalledWith({ global: true })
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

  it('calls signOut when tokenRefresh_failure fires', () => {
    render(<App />)
    const hubListener = vi.mocked(Hub.listen).mock.calls[0][1] as (e: { payload: { event: string } }) => void
    hubListener({ payload: { event: 'tokenRefresh_failure' } })
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
