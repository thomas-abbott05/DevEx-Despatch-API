import { deleteJson, getJson, postJson } from '@/lib/api-client'

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

export async function uploadInvoiceXmlDocuments(documents) {
  const payload = await postJson(
    '/api/v2/user/invoice/upload',
    { documents },
    'Unable to upload invoice XML documents.',
  )

  return {
    invoices: Array.isArray(payload?.invoices) ? payload.invoices : [],
    uploadedCount: Number(payload?.uploadedCount) || 0,
    failedCount: Number(payload?.failedCount) || 0,
    failures: Array.isArray(payload?.failures) ? payload.failures : [],
  }
}

export async function updateInvoiceStatus(uuid, status) {
  const responsePayload = await postJson(
    '/api/v2/user/invoices/' + encodeURIComponent(uuid) + '/status',
    { status },
    'Unable to update invoice status.'
  )

  return responsePayload?.invoice || null
}

export async function deleteInvoice(uuid) {
  const payload = await deleteJson(
    '/api/v2/user/invoices/' + encodeURIComponent(uuid),
    'Unable to delete invoice.'
  )

  return payload
}
