export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const requestHeaders = new Headers(headers)
  let requestBody

  if (body !== undefined) {
    if (body instanceof FormData || body instanceof Blob) {
      requestBody = body
    } else {
      requestHeaders.set('Content-Type', 'application/json')
      requestBody = JSON.stringify(body)
    }
  }

  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: requestHeaders,
    body: requestBody,
    signal,
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(data?.error || 'Ocorreu um erro ao comunicar com a API.', {
      status: response.status,
      code: data?.code,
      details: data?.details,
    })
  }
  return data
}
