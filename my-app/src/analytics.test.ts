import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import posthog from 'posthog-js'

// posthog-js is globally mocked in test/setup.ts
// Use vi.stubEnv to control VITE_POSTHOG_KEY between test groups

import { initAnalytics, identifyUser, resetAnalytics, track } from './analytics'

describe('analytics — key absent (dev/CI)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.clearAllMocks()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('initAnalytics does not call posthog.init', () => {
    initAnalytics()
    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.register).not.toHaveBeenCalled()
  })

  it('identifyUser is a no-op', () => {
    identifyUser('uid', 'user@example.com')
    expect(posthog.register).not.toHaveBeenCalled()
    expect(posthog.identify).not.toHaveBeenCalled()
  })

  it('resetAnalytics is a no-op', () => {
    resetAnalytics()
    expect(posthog.reset).not.toHaveBeenCalled()
    expect(posthog.register).not.toHaveBeenCalled()
  })

  it('track is a no-op', () => {
    track('plan_exported_pdf', { object_count: 5 })
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})

describe('analytics — key present', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_testkey')
    resetAnalytics()
    vi.clearAllMocks()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('initAnalytics calls posthog.init with the key', () => {
    initAnalytics()
    expect(posthog.init).toHaveBeenCalledWith('phc_testkey', expect.objectContaining({
      api_host: 'https://us.i.posthog.com',
    }))
    expect(posthog.register).toHaveBeenCalledWith(expect.objectContaining({
      auth_state: 'anonymous',
    }))
  })

  it('identifyUser calls posthog.identify with userId and email', () => {
    identifyUser('uid-123', 'user@example.com')
    expect(posthog.register).toHaveBeenCalledWith(expect.objectContaining({
      auth_state: 'identified',
    }))
    expect(posthog.identify).toHaveBeenCalledWith('uid-123', { email: 'user@example.com' })
  })

  it('identifyUser omits email when null', () => {
    identifyUser('uid-123', null)
    expect(posthog.identify).toHaveBeenCalledWith('uid-123', { email: undefined })
  })

  it('resetAnalytics calls posthog.reset', () => {
    identifyUser('uid-123', 'user@example.com')
    vi.clearAllMocks()
    resetAnalytics()
    expect(posthog.reset).toHaveBeenCalledOnce()
    expect(posthog.register).toHaveBeenCalledWith(expect.objectContaining({
      auth_state: 'anonymous',
    }))
  })

  it('track calls posthog.capture with caller-supplied properties', () => {
    track('plan_exported_pdf', { object_count: 3 })
    expect(posthog.capture).toHaveBeenCalledWith('plan_exported_pdf', { object_count: 3 })
  })

  it('track passes undefined properties when none supplied', () => {
    track('plan_exported_pdf')
    expect(posthog.capture).toHaveBeenCalledWith('plan_exported_pdf', undefined)
  })

  it('track does not pass auth_state or environment (handled by posthog.register super-properties)', () => {
    track('plan_exported_pdf', { object_count: 3 })
    const [, capturedProps] = vi.mocked(posthog.capture).mock.calls[0]
    expect(capturedProps).not.toHaveProperty('auth_state')
    expect(capturedProps).not.toHaveProperty('environment')
  })
})
