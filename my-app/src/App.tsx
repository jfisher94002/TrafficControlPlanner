import { useEffect, useState, useCallback } from 'react'
import { Amplify } from 'aws-amplify'
import { signUp, signOut as amplifySignOut, getCurrentUser } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import TrafficControlPlanner from './traffic-control-planner'
import awsExports from './aws-exports'
import { authTheme } from './auth/theme'
import { AuthHeader } from './auth/AuthHeader'
import { identifyUser, resetAnalytics } from './analytics'

Amplify.configure(awsExports)

// Amplify UI doesn't always forward custom formFields to Cognito automatically.
// This ensures `name` from the sign-up form is included in the signUp call.
const authServices = {
  async handleSignUp(input: Parameters<typeof signUp>[0]) {
    const attrs = (input.options?.userAttributes ?? {}) as Record<string, string>
    const name = attrs['name'] ?? ''
    return signUp({
      ...input,
      options: {
        ...input.options,
        userAttributes: { ...attrs, name },
      },
    })
  },
}

const signInFormFields = {
  signUp: {
    name: {
      label: 'Full Name',
      placeholder: 'Enter your full name',
      isRequired: true,
      order: 1,
    },
    email: { order: 2 },
    password: { order: 3 },
    confirm_password: { order: 4 },
  },
}

export default function App() {
  // Evaluated at render time so test mocks can override the config object
  const AUTH_ENABLED = Boolean(awsExports.aws_user_pools_id && awsExports.aws_user_pools_web_client_id)

  const [userId, setUserId]       = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    if (!AUTH_ENABLED) return

    // Restore session if user is already signed in
    getCurrentUser()
      .then(u => {
        const email = u.signInDetails?.loginId ?? null
        setUserId(u.username)
        setUserEmail(email)
        identifyUser(u.username, email)
      })
      .catch(() => { /* not signed in — that's fine */ })

    // React to auth events: sign-in, sign-out, token refresh failures
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
  }, [AUTH_ENABLED]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = useCallback(async () => {
    try {
      await amplifySignOut({ global: true })
    } catch (err) {
      console.error('[Auth] signOut error:', err)
    } finally {
      window.location.href = '/'
    }
  }, [])

  if (!AUTH_ENABLED) {
    return <TrafficControlPlanner userId={null} />
  }

  return (
    <ThemeProvider theme={authTheme} colorMode="dark">
      <TrafficControlPlanner
        userId={userId}
        userEmail={userEmail}
        onSignOut={userId ? handleSignOut : undefined}
        onRequestSignIn={() => setShowSignIn(true)}
      />

      {showSignIn && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowSignIn(false)}
        >
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowSignIn(false)}
              aria-label="Close sign-in"
              style={{
                position: 'absolute', top: -36, right: 0,
                background: 'none', border: 'none', color: '#94a3b8',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}
            >
              ✕ Close
            </button>
            <p style={{
              textAlign: 'center', fontSize: 12, color: '#94a3b8',
              marginBottom: 12, fontFamily: "'JetBrains Mono', monospace",
            }}>
              Sign in to export your plan as PDF
            </p>
            <Authenticator
              loginMechanisms={['email']}
              components={{ Header: AuthHeader }}
              services={authServices}
              formFields={signInFormFields}
            >
              {() => <></>}
            </Authenticator>
          </div>
        </div>
      )}
    </ThemeProvider>
  )
}
