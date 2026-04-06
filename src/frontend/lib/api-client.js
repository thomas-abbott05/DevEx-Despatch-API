export async function readResponsePayload(response) {
  try {
    const responseText = await response.text()

    if (!responseText) {
      return null
    }

    try {
      return JSON.parse(responseText)
    } catch {
      return responseText
    }
  } catch {
    return null
  }
}

export function getErrorMessage(payload, fallbackMessage) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors
      .map((error) => (typeof error === 'string' ? error : String(error)))
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.trim()
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }

  if (typeof payload?.reason === 'string' && payload.reason.trim()) {
    return payload.reason.trim()
  }

  return fallbackMessage
}

export async function getJson(path, fallbackMessage) {
  const response = await fetch(path, {
    method: 'GET',
    credentials: 'include'
  })

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackMessage))
  }

  return payload
}

export async function postJson(path, body, fallbackMessage) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackMessage))
  }

  return payload
}

export async function deleteJson(path, fallbackMessage) {
  const response = await fetch(path, {
    method: 'DELETE',
    credentials: 'include'
  })

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, fallbackMessage))
  }

  return payload
}
