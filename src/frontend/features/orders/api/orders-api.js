import { deleteJson, getJson, postJson } from '@/lib/api-client'

export async function fetchOrderSummaries() {
  const payload = await getJson('/api/v2/user/orders', 'Unable to load orders.')
  return Array.isArray(payload?.orders) ? payload.orders : []
}

export async function fetchNextOrderDisplayId() {
  const orders = await fetchOrderSummaries()
  return 'ORD-' + String(orders.length + 1)
}

export async function fetchOrderDetail(uuid) {
  const payload = await getJson('/api/v2/user/orders/' + encodeURIComponent(uuid), 'Unable to load order details.')
  return payload?.order || null
}

export async function createOrderDocument(orderPayload) {
  const payload = await postJson('/api/v2/user/order/create', orderPayload, 'Unable to create order document.')
  return payload?.order || null
}

export async function deleteOrder(uuid) {
  const payload = await deleteJson('/api/v2/user/orders/' + encodeURIComponent(uuid), 'Unable to delete order.')
  return payload
}
