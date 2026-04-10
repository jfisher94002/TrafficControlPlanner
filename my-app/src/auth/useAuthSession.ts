import { useEffect, useState, useCallback } from 'react'
import { getCurrentUser, signOut as amplifySignOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { identifyUser, resetAnalytics } from '../analytics'

export interface AuthSession {
  userId: string | null
  userEmail: string | null
  showSignIn: boolean
  openSignIn: () => void
  closeSignIn: () => void
  handleSignOut: () => Promise<void>
}

export function useAuthSession(authEnabled: boolean): AuthSession {
  const [userId, setUserId]       = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showSignIn, setShowSignIn] = useState(false)

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
      .then(u => {
        const email = u.signInDetails?.loginId ?? null
        setUserId(u.username)
        setUserEmail(email)
        identifyUser(u.username, email)
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
      } else if (payload.event === 'signedOut') {
        setUserId(null)
        setUserEmail(null)
        resetAnalytics()
      } else if (payload.event === 'tokenRefresh_failure') {
        handleSignOut()
      }
    })

    return unsubscribe
  }, [authEnabled, handleSignOut])

  return {
    userId,
    userEmail,
    showSignIn,
    openSignIn:  () => setShowSignIn(true),
    closeSignIn: () => setShowSignIn(false),
    handleSignOut,
  }
}
