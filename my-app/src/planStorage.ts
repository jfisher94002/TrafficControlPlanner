/**
 * Cloud plan persistence via AWS Amplify v6 Storage (S3).
 *
 * Plans are stored at:  plans/{userId}/{planId}.tcp.json
 * Access is scoped to the authenticated user via S3 bucket policy.
 *
 * All functions throw on failure — callers are responsible for error handling.
 */

/** Increment when the stored plan shape changes in a breaking way. */
export const PLAN_SCHEMA_VERSION = 1
import { uploadData, list, getUrl, remove } from 'aws-amplify/storage'

export interface CloudPlanMeta {
  path: string
  planId: string
  name: string        // derived from filename (planId); plan JSON title is not fetched at list time
  lastModified: string
  size: number
}

/** Upload (create or overwrite) a plan to S3. */
export async function savePlanToCloud(userId: string, planId: string, data: object): Promise<void> {
  await uploadData({
    path: `plans/${userId}/${planId}.tcp.json`,
    data: JSON.stringify({ ...data, _schemaVersion: PLAN_SCHEMA_VERSION }),
    options: { contentType: 'application/json' },
  }).result
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

/** Fetch and parse a plan from S3 by its path. */
export async function loadPlanFromCloud(path: string): Promise<Record<string, unknown>> {
  const { url } = await getUrl({ path, options: { expiresIn: 60 } })
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch plan (${res.status})`)
  const data = await res.json() as Record<string, unknown>
  const version = typeof data._schemaVersion === 'number' ? data._schemaVersion : 0
  if (version > PLAN_SCHEMA_VERSION) {
    throw new Error(`Plan was saved with a newer version of TCPlanPro (v${version}). Please refresh the app.`)
  }
  return data
}

/** Delete a plan from S3. */
export async function deletePlanFromCloud(path: string): Promise<void> {
  await remove({ path })
}
