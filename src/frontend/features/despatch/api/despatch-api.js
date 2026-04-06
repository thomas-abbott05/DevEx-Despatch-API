import { deleteJson, getJson, postJson } from '@/lib/api-client'

export async function fetchDespatchSummaries() {
  const payload = await getJson('/api/v2/user/despatch', 'Unable to load despatch documents.')
  return Array.isArray(payload?.despatch) ? payload.despatch : []
}

export async function fetchDespatchDetail(uuid) {
  const payload = await getJson('/api/v2/user/despatch/' + encodeURIComponent(uuid), 'Unable to load despatch details.')
  return payload?.despatch || null
}

export async function createDespatchFromOrder(payload) {
  const responsePayload = await postJson('/api/v2/user/despatch/create', payload, 'Unable to create despatch advice.')

  return {
    adviceIds: Array.isArray(responsePayload?.adviceIds) ? responsePayload.adviceIds : [],
    despatch: Array.isArray(responsePayload?.despatch) ? responsePayload.despatch : []
  }
}

export async function uploadDespatchXmlDocuments(documents) {
  const payload = await postJson(
    '/api/v2/user/despatch/upload',
    { documents },
    'Unable to upload despatch XML documents.',
  )

  return {
    despatch: Array.isArray(payload?.despatch) ? payload.despatch : [],
    uploadedCount: Number(payload?.uploadedCount) || 0,
    failedCount: Number(payload?.failedCount) || 0,
    failures: Array.isArray(payload?.failures) ? payload.failures : [],
  }
}

export async function deleteDespatch(uuid) {
  const payload = await deleteJson('/api/v2/user/despatch/' + encodeURIComponent(uuid), 'Unable to delete despatch advice.')
  return payload
}

export async function updateDespatchStatus(uuid, status) {
  const responsePayload = await postJson(
    '/api/v2/user/despatch/' + encodeURIComponent(uuid) + '/status',
    { status },
    'Unable to update despatch status.'
  )

  return responsePayload?.despatch || null
}
