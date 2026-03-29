import { useEffect } from 'react'
import { Amplify } from 'aws-amplify'
import { signUp, signOut as amplifySignOut } from 'aws-amplify/auth'
import { Authenticator, ThemeProvider, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import TrafficControlPlanner from './traffic-control-planner'
import awsExports from './aws-exports'
import { authTheme } from './auth/theme'
import { AuthHeader } from './auth/AuthHeader'
import { useAutoSignOut } from './auth/useAutoSignOut'
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

function AuthedApp() {
  const { signOut, user } = useAuthenticator((ctx) => [ctx.user])
  useAutoSignOut(signOut)

  const userId    = user?.username ?? null
  const userEmail = user?.signInDetails?.loginId ?? null

  // Re-identify whenever the signed-in user changes
  useEffect(() => {
    if (userId) identifyUser(userId, userEmail)
  }, [userId, userEmail])

  // Reset analytics only on unmount (sign-out / session end)
  useEffect(() => {
    return () => { resetAnalytics() }
  }, [])

  const handleSignOut = async () => {
    try {
      // global: true revokes the Cognito refresh token server-side so the
      // user isn't auto-signed back in when they return to /app.
      await amplifySignOut({ global: true })
    } catch (err) {
      // Log so server-side session failures are visible in monitoring.
      console.error('[Auth] signOut error:', err)
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <TrafficControlPlanner
      userId={userId}
      userEmail={userEmail}
      onSignOut={handleSignOut}
    />
  )
}

export default function App() {
  // Evaluated at render time so test mocks can override the config object
  const AUTH_ENABLED = Boolean(awsExports.aws_user_pools_id && awsExports.aws_user_pools_web_client_id)

  if (!AUTH_ENABLED) {
    return <TrafficControlPlanner userId={null} />
  }

  return (
    <ThemeProvider theme={authTheme} colorMode="dark">
      <Authenticator
        loginMechanisms={['email']}
        components={{ Header: AuthHeader }}
        services={authServices}
        formFields={{
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
        }}
      >
        {() => <AuthedApp />}
      </Authenticator>
    </ThemeProvider>
  )
}
