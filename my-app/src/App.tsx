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

  useEffect(() => {
    if (userId) identifyUser(userId, userEmail)
    return () => { resetAnalytics() }
  }, [userId, userEmail])

  return (
    <TrafficControlPlanner
      userId={userId}
      userEmail={userEmail}
      onSignOut={signOut}
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
      <Authenticator loginMechanisms={['email']} components={{ Header: AuthHeader }}>
        {() => <AuthedApp />}
      </Authenticator>
    </ThemeProvider>
  )
}
