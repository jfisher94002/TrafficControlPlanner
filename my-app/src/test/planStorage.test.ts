import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as amplifyStorage from 'aws-amplify/storage'
import * as planMigration from '../planMigration'

// planStorage is imported after mocks are set up so it picks up the vi.mock stubs
// (setup.ts in vitest config already mocks 'aws-amplify/storage')
import {
  PLAN_SCHEMA_VERSION,
  savePlanToCloud,
  fetchRemoteUpdatedAt,
  listCloudPlans,
  loadPlanFromCloud,
} from '../planStorage'

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

  it('preserves an existing schema version in payload data', async () => {
    const uploadDataSpy = vi.spyOn(amplifyStorage, 'uploadData').mockReturnValue({
      result: Promise.resolve({} as never),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      state: 'SUCCESS' as never,
    })

    await savePlanToCloud('user-abc', 'plan-legacy', {
      _schemaVersion: 1,
      updatedAt: '2026-04-15T10:00:00.000Z',
    })

    const body = JSON.parse(String(uploadDataSpy.mock.calls[0]?.[0]?.data))
    expect(body._schemaVersion).toBe(1)
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

  it('returns null when getProperties throws with NoSuchKey name', async () => {
    const notFound = new Error('missing object')
    notFound.name = 'NoSuchKey'
    vi.spyOn(amplifyStorage, 'getProperties').mockRejectedValue(notFound)

    const result = await fetchRemoteUpdatedAt('plans/user-1/plan-1.tcp.json')
    expect(result).toBeNull()
  })

  it('rethrows non-NotFound errors so callers can fail conflict checks', async () => {
    vi.spyOn(amplifyStorage, 'getProperties').mockRejectedValue(new Error('AccessDenied'))
    await expect(fetchRemoteUpdatedAt('plans/user-1/plan-1.tcp.json')).rejects.toThrow('AccessDenied')
  })
})

describe('listCloudPlans', () => {
  it('filters non-plan files and sorts by lastModified descending', async () => {
    vi.spyOn(amplifyStorage, 'list').mockResolvedValue({
      items: [
        {
          path: 'plans/user-1/old-plan.tcp.json',
          lastModified: new Date('2026-01-01T00:00:00.000Z'),
          size: 11,
        },
        {
          path: 'plans/user-1/readme.txt',
          lastModified: new Date('2026-02-01T00:00:00.000Z'),
          size: 99,
        },
        {
          path: 'plans/user-1/new-plan.tcp.json',
          lastModified: new Date('2026-03-01T00:00:00.000Z'),
          size: 22,
        },
      ],
    } as never)

    const result = await listCloudPlans('user-1')

    expect(result).toEqual([
      expect.objectContaining({ planId: 'new-plan', name: 'new-plan' }),
      expect.objectContaining({ planId: 'old-plan', name: 'old-plan' }),
    ])
    expect(result).toHaveLength(2)
    expect(amplifyStorage.list).toHaveBeenCalledWith({
      path: 'plans/user-1/',
      options: { listAll: true },
    })
  })

  it('uses safe defaults when size and lastModified are missing', async () => {
    vi.spyOn(amplifyStorage, 'list').mockResolvedValue({
      items: [{ path: 'plans/user-1/no-meta.tcp.json' }],
    } as never)

    const [item] = await listCloudPlans('user-1')
    expect(item.lastModified).toBe('')
    expect(item.size).toBe(0)
  })
})

describe('loadPlanFromCloud', () => {
  it('fetches via a signed url and returns v1 plans unchanged', async () => {
    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/plan-v1.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'plan-v1', _schemaVersion: 1 }),
    } as Response)

    const result = await loadPlanFromCloud('plans/user-1/plan-v1.tcp.json', { w: 800, h: 600 })
    expect(result).toEqual({ id: 'plan-v1', _schemaVersion: 1 })
    expect(amplifyStorage.getUrl).toHaveBeenCalledWith({
      path: 'plans/user-1/plan-v1.tcp.json',
      options: { expiresIn: 60 },
    })
  })

  it('throws a clear error when plan fetch returns non-200', async () => {
    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/plan-404.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response)

    await expect(loadPlanFromCloud('plans/user-1/missing.tcp.json', { w: 800, h: 600 }))
      .rejects
      .toThrow('Failed to fetch plan (404)')
  })

  it('rejects plans saved with unsupported newer schema versions', async () => {
    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/plan-v99.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ _schemaVersion: PLAN_SCHEMA_VERSION + 1 }),
    } as Response)

    await expect(loadPlanFromCloud('plans/user-1/future.tcp.json', { w: 800, h: 600 }))
      .rejects
      .toThrow(`v${PLAN_SCHEMA_VERSION + 1}`)
  })

  it('converts v2 plan-space payloads back to world coords before returning', async () => {
    const v2Raw = { _schemaVersion: 2, canvasState: { objects: [] } }
    const converted = { id: 'converted-plan', canvasState: { objects: [{ id: '1' }] } }
    vi.spyOn(amplifyStorage, 'getUrl').mockResolvedValue({
      url: new URL('https://example.com/plan-v2.json'),
    } as never)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => v2Raw,
    } as Response)
    vi.spyOn(planMigration, 'detectSchemaVersion').mockReturnValue(2)
    const v2ToWorldSpy = vi.spyOn(planMigration, 'v2ToWorldCoords').mockReturnValue({
      plan: converted,
      stats: { objectCount: 1, convertedCount: 1, skippedCount: 0 },
    })

    const result = await loadPlanFromCloud('plans/user-1/v2.tcp.json', { w: 1024, h: 768 })
    expect(v2ToWorldSpy).toHaveBeenCalledWith(v2Raw, { w: 1024, h: 768 })
    expect(result).toEqual(converted)
  })
})
