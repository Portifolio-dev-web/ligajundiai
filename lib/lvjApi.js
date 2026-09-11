export const CATEGORY_FALLBACK = [
  'Adulto Masculino',
  'Adulto Feminino',
  'Master Masculino',
  'Master Feminino',
  'Sub-19 Masculino',
  'Sub-19 Feminino',
]

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Ocorreu um erro')
  return data
}
