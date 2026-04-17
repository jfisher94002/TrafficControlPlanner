import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuthSession } from './useAuthSession'

const {
  mockGetCurrentUser,
  mockAmplifySignOut,
  mockHubListen,
  mockHubUnsubscribe,
  mockIdentifyUser,
  mockResetAnalytics,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockAmplifySignOut: vi.fn().mockResolvedValue(undefined),
  mockHubListen: vi.fn(),
  mockHubUnsubscribe: vi.fn(),
  mockIdentifyUser: vi.fn(),
  mockResetAnalytics: vi.fn(),
}))

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
  signOut: mockAmplifySignOut,
}))

vi.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: mockHubListen,
  },
}))

vi.mock('../analytics', () => ({
  identifyUser: mockIdentifyUser,
  resetAnalytics: mockResetAnalytics,
}))

describe('useAuthSession', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockRejectedValue(new Error('not signed in'))
    mockHubListen.mockImplementation((_channel: string, _callback: unknown) => mockHubUnsubscribe)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not initialize auth listeners when auth is disabled', () => {
    renderHook(() => useAuthSession(false))
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
    expect(mockHubListen).not.toHaveBeenCalled()
  })

  it('hydrates user state from getCurrentUser and identifies the user', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'user-123',
      signInDetails: { loginId: 'user@example.com' },
    })
    const { result } = renderHook(() => useAuthSession(true))

    await waitFor(() => {
      expect(result.current.userId).toBe('user-123')
      expect(result.current.userEmail).toBe('user@example.com')
    })

    expect(mockIdentifyUser).toHaveBeenCalledWith('user-123', 'user@example.com')
  })

  it('clears user state and resets analytics on Hub signedOut', async () => {
    mockGetCurrentUser.mockResolvedValue({
      username: 'user-123',
      signInDetails: { loginId: 'user@example.com' },
    })
    const { result } = renderHook(() => useAuthSession(true))

    await waitFor(() => expect(result.current.userId).toBe('user-123'))

    const hubCallback = mockHubListen.mock.calls[0][1] as (event: { payload: { event: string } }) => void
    act(() => {
      hubCallback({ payload: { event: 'signedOut' } })
    })

    expect(result.current.userId).toBeNull()
    expect(result.current.userEmail).toBeNull()
    expect(mockResetAnalytics).toHaveBeenCalledTimes(1)
  })

  it('signs out globally when Hub emits tokenRefresh_failure', async () => {
    renderHook(() => useAuthSession(true))
    const hubCallback = mockHubListen.mock.calls[0][1] as (event: { payload: { event: string } }) => void

    act(() => {
      hubCallback({ payload: { event: 'tokenRefresh_failure' } })
    })

    await waitFor(() => {
      expect(mockAmplifySignOut).toHaveBeenCalledWith({ global: true })
    })
  })

  it('openSignIn/closeSignIn toggle modal state and signedIn closes it', async () => {
    const { result } = renderHook(() => useAuthSession(true))

    act(() => {
      result.current.openSignIn()
    })
    expect(result.current.showSignIn).toBe(true)

    const hubCallback = mockHubListen.mock.calls[0][1] as (event: { payload: { event: string; data?: unknown } }) => void
    act(() => {
      hubCallback({
        payload: {
          event: 'signedIn',
          data: { username: 'fresh-user', signInDetails: { loginId: 'fresh@example.com' } },
        },
      })
    })

    await waitFor(() => {
      expect(result.current.userId).toBe('fresh-user')
      expect(result.current.userEmail).toBe('fresh@example.com')
      expect(result.current.showSignIn).toBe(false)
    })

    act(() => {
      result.current.closeSignIn()
    })
    expect(result.current.showSignIn).toBe(false)
    expect(mockIdentifyUser).toHaveBeenCalledWith('fresh-user', 'fresh@example.com')
  })

  it('handleSignOut logs and swallows sign-out errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAmplifySignOut.mockRejectedValueOnce(new Error('sign-out failed'))

    const { result } = renderHook(() => useAuthSession(true))
    await act(async () => {
      await result.current.handleSignOut()
    })

    expect(consoleSpy).toHaveBeenCalledWith('[Auth] signOut error:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  it('unsubscribes Hub listener on unmount', () => {
    const { unmount } = renderHook(() => useAuthSession(true))
    const callsBeforeUnmount = mockHubUnsubscribe.mock.calls.length
    unmount()
    expect(mockHubUnsubscribe.mock.calls.length).toBeGreaterThan(callsBeforeUnmount)
  })
})
