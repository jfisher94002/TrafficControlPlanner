import { useEffect, useState, useCallback } from 'react'
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { identifyUser, resetAnalytics } from '../analytics'

export interface AuthSession {
  userId: string | null
  userEmail: string | null
  isAdmin: boolean
  /** Raw Cognito access token — used by admin API calls */
  accessToken: string | null
  showSignIn: boolean
  openSignIn: () => void
  closeSignIn: () => void
  handleSignOut: () => Promise<void>
}

export function useAuthSession(authEnabled: boolean): AuthSession {
  const [userId, setUserId]           = useState<string | null>(null)
  const [userEmail, setUserEmail]     = useState<string | null>(null)
  const [isAdmin, setIsAdmin]         = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [showSignIn, setShowSignIn]   = useState(false)

  const _hydrateSession = useCallback(async () => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.accessToken?.toString() ?? null
      setAccessToken(token)
      // Cognito groups are in the access token payload under "cognito:groups"
      const payload = session.tokens?.accessToken?.payload
      const groups = (payload?.['cognito:groups'] as string[] | undefined) ?? []
      setIsAdmin(groups.includes('admins'))
    } catch {
      // session fetch failed — reset to safe defaults
      setIsAdmin(false)
      setAccessToken(null)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      await amplifySignOut({ global: true })
    } catch (err) {
      console.error('[Auth] signOut error:', err)
    }
    // Stay on the current page — Hub signedOut event clears userId/userEmail
  }, [])

  useEffect(() => {
    if (!authEnabled) return

    getCurrentUser()
      .then(async u => {
        const email = u.signInDetails?.loginId ?? null
        setUserId(u.username)
        setUserEmail(email)
        identifyUser(u.username, email)
        await _hydrateSession()
      })
      .catch(() => { /* not signed in — that's fine */ })

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        const u = payload.data as { username: string; signInDetails?: { loginId?: string } }
        const email = u.signInDetails?.loginId ?? null
        setUserId(u.username)
        setUserEmail(email)
        setShowSignIn(false)
        identifyUser(u.username, email)
        _hydrateSession()
      } else if (payload.event === 'signedOut') {
        setUserId(null)
        setUserEmail(null)
        setIsAdmin(false)
        setAccessToken(null)
        resetAnalytics()
      } else if (payload.event === 'tokenRefresh_failure') {
        handleSignOut()
      }
    })

    return unsubscribe
  }, [authEnabled, handleSignOut, _hydrateSession])

  return {
    userId,
    userEmail,
    isAdmin,
    accessToken,
    showSignIn,
    openSignIn:  () => setShowSignIn(true),
    closeSignIn: () => setShowSignIn(false),
    handleSignOut,
  }
}
