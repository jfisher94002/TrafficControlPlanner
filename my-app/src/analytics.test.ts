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
    expect(posthog.identify).not.toHaveBeenCalled()
    expect(posthog.register).not.toHaveBeenCalled()
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
      environment: expect.any(String),
    }))
  })

  it('identifyUser calls posthog.identify with userId and email', () => {
    identifyUser('uid-123', 'user@example.com')
    expect(posthog.register).toHaveBeenCalledWith(expect.objectContaining({
      auth_state: 'identified',
      environment: expect.any(String),
    }))
    expect(posthog.identify).toHaveBeenCalledWith('uid-123', { email: 'user@example.com' })
  })

  it('identifyUser omits email when null', () => {
    identifyUser('uid-123', null)
    expect(posthog.identify).toHaveBeenCalledWith('uid-123', { email: undefined })
  })

  it('resetAnalytics calls posthog.reset', () => {
    identifyUser('uid-123', 'user@example.com')
    resetAnalytics()
    expect(posthog.reset).toHaveBeenCalledOnce()
    expect(posthog.register).toHaveBeenLastCalledWith(expect.objectContaining({
      auth_state: 'anonymous',
      environment: expect.any(String),
    }))
  })

  it('track calls posthog.capture with event and properties', () => {
    track('plan_exported_pdf', { object_count: 3 })
    expect(posthog.capture).toHaveBeenCalledWith('plan_exported_pdf', { object_count: 3 })
  })
})
