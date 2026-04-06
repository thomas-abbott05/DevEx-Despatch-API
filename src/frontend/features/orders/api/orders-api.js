import { getJson } from '@/lib/api-client'

export async function fetchOrderSummaries() {
  const payload = await getJson('/api/v2/user/orders', 'Unable to load orders.')
  return Array.isArray(payload?.orders) ? payload.orders : []
}

export async function fetchOrderDetail(uuid) {
  const payload = await getJson('/api/v2/user/orders/' + encodeURIComponent(uuid), 'Unable to load order details.')
  return payload?.order || null
}
