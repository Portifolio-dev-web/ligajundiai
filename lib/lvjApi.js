export const CATEGORY_FALLBACK = [
  'Adulto Masculino',
  'Adulto Feminino',
  'Master Masculino',
  'Master Feminino',
  'Sub-19 Masculino',
  'Sub-19 Feminino',
]

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'Ocorreu um erro')
    error.code = data.code
    throw error
  }
  return data
}
