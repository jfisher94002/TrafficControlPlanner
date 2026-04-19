import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as amplifyStorage from 'aws-amplify/storage'
import * as planMigration from '../planMigration'

// planStorage is imported after mocks are set up so it picks up the vi.mock stubs
// (setup.ts in vitest config already mocks 'aws-amplify/storage')
import { savePlanToCloud, fetchRemoteUpdatedAt, loadPlanFromCloud } from '../planStorage'

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

    const payload = JSON.parse((uploadDataSpy.mock.calls[0]?.[0] as { data: string }).data)
    expect(payload._schemaVersion).toBe(2)
  })

  it('preserves existing _schemaVersion when provided by caller data', async () => {
    const uploadDataSpy = vi.spyOn(amplifyStorage, 'uploadData').mockReturnValue({
      result: Promise.resolve({} as never),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      state: 'SUCCESS' as never,
    })

    await savePlanToCloud('user-abc', 'plan-legacy', {
      updatedAt: '2026-04-15T11:00:00.000Z',
      _schemaVersion: 1,
    } as { updatedAt: string } & Record<string, unknown>)

    const payload = JSON.parse((uploadDataSpy.mock.calls[0]?.[0] as { data: string }).data)
    expect(payload._schemaVersion).toBe(1)
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

describe('loadPlanFromCloud', () => {
  it('returns parsed data unchanged for v1 plans', async () => {
    const v1Plan = { _schemaVersion: 1, id: 'plan-v1', canvasState: { objects: [] } }
    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/v1-plan.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => v1Plan,
    } as Response)

    const result = await loadPlanFromCloud('plans/user-1/plan-v1.tcp.json', { w: 800, h: 600 })
    expect(result).toEqual(v1Plan)
  })

  it('throws a compatibility error for plans newer than supported schema', async () => {
    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/newer-plan.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _schemaVersion: 3 }),
    } as Response)

    await expect(
      loadPlanFromCloud('plans/user-1/newer.tcp.json', { w: 800, h: 600 })
    ).rejects.toThrow('Plan was saved with a newer version of TCPlanPro (v3). Please refresh the app.')
  })

  it('migrates v2 plans to world coordinates before returning', async () => {
    const rawV2 = {
      _schemaVersion: 2,
      geoContext: { mapCenter: { lat: 37.7, lng: -122.4 }, mapZoom: 17 },
      canvasState: { objects: [{ id: 'a', type: 'sign', x: 1, y: 2 }] },
    }
    const migrated = {
      ...rawV2,
      canvasState: { objects: [{ id: 'a', type: 'sign', x: 101, y: 202 }] },
    }
    const migrateSpy = vi.spyOn(planMigration, 'v2ToWorldCoords').mockReturnValue({
      plan: migrated,
      stats: { objectCount: 1, convertedCount: 1, skippedCount: 0 },
    })

    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/v2-plan.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rawV2,
    } as Response)

    const canvasSize = { w: 1200, h: 900 }
    const result = await loadPlanFromCloud('plans/user-1/plan-v2.tcp.json', canvasSize)
    expect(migrateSpy).toHaveBeenCalledWith(rawV2, canvasSize)
    expect(result).toEqual(migrated)
  })
})
