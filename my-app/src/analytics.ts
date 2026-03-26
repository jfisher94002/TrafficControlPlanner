import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined

/** Call once at app startup. No-ops silently when the key is absent. */
export function initAnalytics() {
  if (!KEY) return
  posthog.init(KEY, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: false,
  })
}

/** Tie all future events to the signed-in user. */
export function identifyUser(userId: string, email: string | null) {
  if (!KEY) return
  posthog.identify(userId, { email: email ?? undefined })
}

/** Clear identity on sign-out so events aren't attributed to the previous user. */
export function resetAnalytics() {
  if (!KEY) return
  posthog.reset()
}

/** Track a named event with optional properties. */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!KEY) return
  posthog.capture(event, properties)
}
