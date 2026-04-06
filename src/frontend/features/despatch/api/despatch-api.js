import { getJson } from '@/lib/api-client'

export async function fetchDespatchSummaries() {
  const payload = await getJson('/api/v2/user/despatch', 'Unable to load despatch documents.')
  return Array.isArray(payload?.despatch) ? payload.despatch : []
}

export async function fetchDespatchDetail(uuid) {
  const payload = await getJson('/api/v2/user/despatch/' + encodeURIComponent(uuid), 'Unable to load despatch details.')
  return payload?.despatch || null
}
