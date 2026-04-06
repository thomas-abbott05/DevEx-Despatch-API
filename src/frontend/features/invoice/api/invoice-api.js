import { getJson, postJson } from '@/lib/api-client'

export async function fetchInvoiceSummaries() {
  const payload = await getJson('/api/v2/user/invoices', 'Unable to load invoices.')
  return Array.isArray(payload?.invoices) ? payload.invoices : []
}

export async function fetchInvoiceDetail(uuid) {
  const payload = await getJson('/api/v2/user/invoices/' + encodeURIComponent(uuid), 'Unable to load invoice details.')
  return payload?.invoice || null
}

export async function createInvoiceDocument(payload) {
  const responsePayload = await postJson('/api/v2/user/invoice/create', payload, 'Unable to create invoice document.')
  return responsePayload?.invoice || null
}

export async function createInvoiceFromDespatch(payload) {
  return createInvoiceDocument(payload)
}

export async function updateInvoiceStatus(uuid, status) {
  const responsePayload = await postJson(
    '/api/v2/user/invoices/' + encodeURIComponent(uuid) + '/status',
    { status },
    'Unable to update invoice status.'
  )

  return responsePayload?.invoice || null
}
