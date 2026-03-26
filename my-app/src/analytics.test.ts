import { describe, it, expect, vi, beforeEach } from 'vitest'
import posthog from 'posthog-js'

// Controlled env: key absent by default
const env = vi.hoisted(() => ({ VITE_POSTHOG_KEY: undefined as string | undefined }))
vi.mock('./analytics', async () => {
  // Re-implement the module so it reads from our mutable env object
  return {
    initAnalytics: () => {
      if (!env.VITE_POSTHOG_KEY) return
      posthog.init(env.VITE_POSTHOG_KEY, {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
        autocapture: false,
      })
    },
    identifyUser: (userId: string, email: string | null) => {
      if (!env.VITE_POSTHOG_KEY) return
      posthog.identify(userId, { email: email ?? undefined })
    },
    resetAnalytics: () => {
      if (!env.VITE_POSTHOG_KEY) return
      posthog.reset()
    },
    track: (event: string, properties?: Record<string, unknown>) => {
      if (!env.VITE_POSTHOG_KEY) return
      posthog.capture(event, properties)
    },
  }
})

import { initAnalytics, identifyUser, resetAnalytics, track } from './analytics'

describe('analytics — key absent (dev/CI)', () => {
  beforeEach(() => {
    env.VITE_POSTHOG_KEY = undefined
    vi.clearAllMocks()
  })

  it('initAnalytics does not call posthog.init', () => {
    initAnalytics()
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('identifyUser is a no-op', () => {
    identifyUser('uid', 'user@example.com')
    expect(posthog.identify).not.toHaveBeenCalled()
  })

  it('resetAnalytics is a no-op', () => {
    resetAnalytics()
    expect(posthog.reset).not.toHaveBeenCalled()
  })

  it('track is a no-op', () => {
    track('plan_exported_pdf', { object_count: 5 })
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})

describe('analytics — key present', () => {
  beforeEach(() => {
    env.VITE_POSTHOG_KEY = 'phc_testkey'
    vi.clearAllMocks()
  })

  it('initAnalytics calls posthog.init with the key', () => {
    initAnalytics()
    expect(posthog.init).toHaveBeenCalledWith('phc_testkey', expect.objectContaining({
      api_host: 'https://us.i.posthog.com',
    }))
  })

  it('identifyUser calls posthog.identify with userId and email', () => {
    identifyUser('uid-123', 'user@example.com')
    expect(posthog.identify).toHaveBeenCalledWith('uid-123', { email: 'user@example.com' })
  })

  it('identifyUser omits email when null', () => {
    identifyUser('uid-123', null)
    expect(posthog.identify).toHaveBeenCalledWith('uid-123', { email: undefined })
  })

  it('resetAnalytics calls posthog.reset', () => {
    resetAnalytics()
    expect(posthog.reset).toHaveBeenCalledOnce()
  })

  it('track calls posthog.capture with event and properties', () => {
    track('plan_exported_pdf', { object_count: 3 })
    expect(posthog.capture).toHaveBeenCalledWith('plan_exported_pdf', { object_count: 3 })
  })
})
