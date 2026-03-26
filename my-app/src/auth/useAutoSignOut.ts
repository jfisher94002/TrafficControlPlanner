import { useEffect } from 'react'
import { Hub } from 'aws-amplify/utils'

/** Signs out automatically when Cognito fails to refresh the access token. */
export function useAutoSignOut(signOut: () => void) {
  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'tokenRefresh_failure') {
        signOut()
      }
    })
    return unsubscribe
  }, [signOut])
}
