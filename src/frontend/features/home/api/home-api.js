import { getJson } from '@/lib/api-client'

export async function fetchHomeSummary() {
  const payload = await getJson('/api/v2/user/home-summary', 'Unable to load home summary.')

  return {
    orders: Array.isArray(payload?.orders) ? payload.orders : [],
    despatch: Array.isArray(payload?.despatch) ? payload.despatch : [],
    invoices: Array.isArray(payload?.invoices) ? payload.invoices : []
  }
}
