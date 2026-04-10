import { Amplify } from 'aws-amplify'
import { ThemeProvider } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import TrafficControlPlanner from './traffic-control-planner'
import awsExports from './aws-exports'
import { authTheme } from './auth/theme'
import { useAuthSession } from './auth/useAuthSession'
import { SignInModal } from './auth/SignInModal'

Amplify.configure(awsExports)

export default function App() {
  // Evaluated at render time so test mocks can override the config object
  const AUTH_ENABLED = Boolean(awsExports.aws_user_pools_id && awsExports.aws_user_pools_web_client_id)

  const { userId, userEmail, showSignIn, openSignIn, closeSignIn, handleSignOut } = useAuthSession(AUTH_ENABLED)

  if (!AUTH_ENABLED) {
    return <TrafficControlPlanner userId={null} userEmail={null} />
  }

  return (
    <ThemeProvider theme={authTheme} colorMode="dark">
      <TrafficControlPlanner
        userId={userId}
        userEmail={userEmail}
        onSignOut={userId ? handleSignOut : undefined}
        onRequestSignIn={openSignIn}
      />
      <SignInModal open={showSignIn} onClose={closeSignIn} />
    </ThemeProvider>
  )
}
