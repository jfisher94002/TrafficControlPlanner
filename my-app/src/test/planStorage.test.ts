import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as amplifyStorage from 'aws-amplify/storage'

// planStorage is imported after mocks are set up so it picks up the vi.mock stubs
// (setup.ts in vitest config already mocks 'aws-amplify/storage')
import { savePlanToCloud, fetchRemoteUpdatedAt } from '../planStorage'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('savePlanToCloud', () => {
  it('writes updatedAt to S3 object metadata and uses the correct path', async () => {
    const uploadDataSpy = vi.spyOn(amplifyStorage, 'uploadData').mockReturnValue({
      result: Promise.resolve({} as never),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      state: 'SUCCESS' as never,
    })

    await savePlanToCloud('user-abc', 'plan-xyz', {
      updatedAt: '2026-04-15T10:00:00.000Z',
    })

    expect(uploadDataSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'plans/user-abc/plan-xyz.tcp.json',
        options: expect.objectContaining({
          metadata: expect.objectContaining({ updatedAt: '2026-04-15T10:00:00.000Z' }),
        }),
      })
    )
  })
})

describe('fetchRemoteUpdatedAt', () => {
  it('returns the updatedAt string from S3 metadata', async () => {
    vi.spyOn(amplifyStorage, 'getProperties').mockResolvedValue({
      metadata: { updatedAt: '2026-04-15T12:00:00.000Z' },
    } as never)

    const result = await fetchRemoteUpdatedAt('plans/user-1/plan-1.tcp.json')
    expect(result).toBe('2026-04-15T12:00:00.000Z')
  })

  it('returns null when metadata has no updatedAt field', async () => {
    vi.spyOn(amplifyStorage, 'getProperties').mockResolvedValue({
      metadata: {},
    } as never)

    const result = await fetchRemoteUpdatedAt('plans/user-1/plan-1.tcp.json')
    expect(result).toBeNull()
  })

  it('returns null when getProperties throws (object does not exist)', async () => {
    vi.spyOn(amplifyStorage, 'getProperties').mockRejectedValue(new Error('NoSuchKey'))

    const result = await fetchRemoteUpdatedAt('plans/user-1/plan-1.tcp.json')
    expect(result).toBeNull()
  })
})
