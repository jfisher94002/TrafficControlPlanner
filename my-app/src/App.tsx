import { useEffect } from 'react'
import { Amplify } from 'aws-amplify'
import { Authenticator, ThemeProvider, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import TrafficControlPlanner from './traffic-control-planner'
import awsExports from './aws-exports'
import { authTheme } from './auth/theme'
import { AuthHeader } from './auth/AuthHeader'
import { useAutoSignOut } from './auth/useAutoSignOut'
import { identifyUser, resetAnalytics } from './analytics'

Amplify.configure(awsExports)

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
    await signOut()
    window.location.href = '/'
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
