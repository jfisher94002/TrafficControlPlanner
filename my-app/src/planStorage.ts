/**
 * Cloud plan persistence via AWS Amplify v6 Storage (S3).
 *
 * Plans are stored at:  plans/{userId}/{planId}.tcp.json
 * Access is scoped to the authenticated user via S3 bucket policy.
 *
 * All functions throw on failure — callers are responsible for error handling.
 */

/** Maximum schema version this build can read. Increment when the stored plan shape changes. */
export const PLAN_SCHEMA_VERSION = 2
import { uploadData, list, getUrl, remove, getProperties } from 'aws-amplify/storage'
import { v2ToWorldCoords, detectSchemaVersion } from './planMigration'

export interface CloudPlanMeta {
  path: string
  planId: string
  name: string        // derived from filename (planId); plan JSON title is not fetched at list time
  lastModified: string
  size: number
}

/** Upload (create or overwrite) a plan to S3. The `updatedAt` field is also written to S3 user metadata for conflict detection.
 *  If `data._schemaVersion` is already set, it is preserved; otherwise PLAN_SCHEMA_VERSION is used. */
export async function savePlanToCloud(userId: string, planId: string, data: object & { updatedAt: string }): Promise<void> {
  const dataWithVersion = {
    _schemaVersion: PLAN_SCHEMA_VERSION,
    ...data,
  }
  await uploadData({
    path: `plans/${userId}/${planId}.tcp.json`,
    data: JSON.stringify(dataWithVersion),
    options: { contentType: 'application/json', metadata: { updatedAt: data.updatedAt } },
  }).result
}

/**
 * Returns the `updatedAt` ISO string stored in S3 object metadata for the given path,
 * or null if the object doesn't exist or has no updatedAt metadata field.
 * Throws for any other error (auth failure, throttling, etc.) so callers know
 * the conflict check could not be performed.
 */
export async function fetchRemoteUpdatedAt(path: string): Promise<string | null> {
  try {
    const props = await getProperties({ path })
    return (props.metadata?.updatedAt as string | undefined) ?? null
  } catch (error) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  // Amplify v6 Storage surfaces S3 NoSuchKey as error.name === 'NoSuchKey'.
  // The message fallback handles any future SDK restructuring but is kept
  // narrow (exact code string only) to avoid swallowing unrelated errors.
  return error.name === 'NoSuchKey' || error.message.includes('NoSuchKey')
}

/** List all plans for the given user. */
export async function listCloudPlans(userId: string): Promise<CloudPlanMeta[]> {
  const { items } = await list({
    path: `plans/${userId}/`,
    options: { listAll: true },
  })
  return items
    .filter(item => item.path.endsWith('.tcp.json'))
    .map(item => ({
      path: item.path,
      planId: item.path.split('/').pop()!.replace('.tcp.json', ''),
      name: item.path.split('/').pop()!.replace('.tcp.json', ''),
      lastModified: item.lastModified?.toISOString() ?? '',
      size: item.size ?? 0,
    }))
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified))
}

/**
 * Fetch and parse a plan from S3 by its path.
 * If the plan is v2, converts plan-space coordinates back to world pixels using
 * the live canvasSize before returning, so callers always receive world-pixel coords.
 */
export async function loadPlanFromCloud(
  path: string,
  canvasSize: { w: number; h: number },
): Promise<Record<string, unknown>> {
  const { url } = await getUrl({ path, options: { expiresIn: 60 } })
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch plan (${res.status})`)
  const data = await res.json() as Record<string, unknown>
  const version = typeof data._schemaVersion === 'number' ? data._schemaVersion : 0
  if (version > PLAN_SCHEMA_VERSION) {
    throw new Error(`Plan was saved with a newer version of TCPlanPro (v${version}). Please refresh the app.`)
  }
  if (detectSchemaVersion(data) === 2) {
    const { plan } = v2ToWorldCoords(data, canvasSize)
    return plan
  }
  return data
}

/** Delete a plan from S3. */
export async function deletePlanFromCloud(path: string): Promise<void> {
  await remove({ path })
}
