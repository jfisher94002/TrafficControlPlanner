import { Amplify } from 'aws-amplify'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import TrafficControlPlanner from './traffic-control-planner'
import awsExports from './aws-exports'

Amplify.configure(awsExports)

// If no Cognito User Pool is configured (local dev / CI), bypass auth entirely.
const AUTH_ENABLED = Boolean(awsExports.aws_user_pools_id)

export default function App() {
  if (!AUTH_ENABLED) {
    return <TrafficControlPlanner userId={null} />
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <TrafficControlPlanner
          userId={user?.username ?? null}
          onSignOut={signOut}
        />
      )}
    </Authenticator>
  )
}
