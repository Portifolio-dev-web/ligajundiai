export async function api(path, { method = 'GET', body, signal } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  })

  let data = null
  if (response.status !== 204) {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) data = await response.json()
    else if (!response.ok) data = { error: await response.text() }
  }

  if (!response.ok) {
    const error = new Error(data?.error || `A solicitação falhou (HTTP ${response.status}).`)
    error.code = data?.code
    error.status = response.status
    throw error
  }
  return data ?? {}
}