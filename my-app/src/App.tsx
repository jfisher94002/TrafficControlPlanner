import { useEffect } from 'react'
import { Amplify } from 'aws-amplify'
import { Hub } from 'aws-amplify/utils'
import { Authenticator, ThemeProvider, createTheme, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import TrafficControlPlanner from './traffic-control-planner'
import awsExports from './aws-exports'

Amplify.configure(awsExports)

// Dark theme matching the app's color palette
const theme = createTheme({
  name: 'tcp-dark',
  tokens: {
    colors: {
      background: {
        primary:   { value: '#0f1117' },
        secondary: { value: '#1a1d27' },
      },
      font: {
        primary:   { value: '#e2e8f0' },
        secondary: { value: '#94a3b8' },
        interactive: { value: '#f59e0b' },
      },
      border: {
        primary:   { value: '#2a2d3a' },
        secondary: { value: '#2a2d3a' },
        focus:     { value: '#f59e0b' },
      },
      brand: {
        primary: {
          '10':  { value: 'rgba(245,158,11,0.10)' },
          '20':  { value: 'rgba(245,158,11,0.20)' },
          '40':  { value: 'rgba(245,158,11,0.40)' },
          '60':  { value: '#d97706' },
          '80':  { value: '#f59e0b' },
          '90':  { value: '#fbbf24' },
          '100': { value: '#fde68a' },
        },
      },
    },
    components: {
      authenticator: {
        router: {
          borderWidth: { value: '1px' },
          borderStyle: { value: 'solid' },
          borderColor: { value: '#2a2d3a' },
          backgroundColor: { value: '#1a1d27' },
          boxShadow: { value: '0 8px 40px rgba(0,0,0,0.6)' },
        },
      },
    },
  },
})

// Inner component: listens for token refresh failure and auto-signs out
function AuthedApp() {
  const { signOut, user } = useAuthenticator((ctx) => [ctx.user])

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'tokenRefresh_failure') {
        // Session expired; force a clean sign-out so the login screen reappears
        signOut()
      }
    })
    return unsubscribe
  }, [signOut])

  const userEmail = user?.signInDetails?.loginId ?? null
  const userId    = user?.username ?? null

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
    <ThemeProvider theme={theme} colorMode="dark">
      <Authenticator
        loginMechanisms={['email']}
        components={{
          Header() {
            return (
              <div style={{ textAlign: 'center', padding: '24px 0 8px', color: '#f59e0b' }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>TCP<span style={{ color: '#e2e8f0' }}>lanPro</span></div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Traffic Control Plan Designer</div>
              </div>
            )
          },
        }}
      >
        {() => <AuthedApp />}
      </Authenticator>
    </ThemeProvider>
  )
}
