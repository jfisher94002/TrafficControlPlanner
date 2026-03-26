import posthog from 'posthog-js'

/** Read at call time so tests can control the env without re-importing the module. */
function getKey(): string | undefined {
  return import.meta.env.VITE_POSTHOG_KEY as string | undefined
}

/** Call once at app startup. No-ops silently when the key is absent. */
export function initAnalytics() {
  const key = getKey()
  if (!key) return
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: false,
  })
}

/** Tie all future events to the signed-in user. */
export function identifyUser(userId: string, email: string | null) {
  if (!getKey()) return
  posthog.identify(userId, { email: email ?? undefined })
}

/** Clear identity on sign-out so events aren't attributed to the previous user. */
export function resetAnalytics() {
  if (!getKey()) return
  posthog.reset()
}

/** Track a named event with optional properties. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!getKey()) return
  posthog.capture(event, properties)
}
