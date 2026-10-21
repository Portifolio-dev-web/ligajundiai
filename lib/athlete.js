export const ATHLETE_POSITIONS = [
  { value: 'central', label: 'Central' },
  { value: 'ponteiro', label: 'Ponteiro' },
  { value: 'saida', label: 'Oposto / saída' },
  { value: 'levantador', label: 'Levantador' },
  { value: 'libero', label: 'Líbero' },
]

// Decisão (análise LVJ 2027, risco 1): identificação por RG, não mais por CPF. O RG não tem um
// formato nacional fixo (cada estado emite no seu), então, diferente do CPF, não há máscara com
// pontos/traço nem dígito verificador calculável — só filtramos dígitos e o "X" alfabético que
// algumas UFs (SP, RJ, MG) usam como último caractere.
export function formatRg(value) {
  return String(value ?? '').toUpperCase().replace(/[^0-9X]/g, '').slice(0, 10)
}

export function isValidRg(value) {
  const rg = formatRg(value)
  return /^\d{5,9}X?$/.test(rg)
}

export function getAge(birthdate, today = new Date()) {
  if (!birthdate) return null
  const date = new Date(`${birthdate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  let age = today.getFullYear() - date.getFullYear()
  const beforeBirthday = today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  if (beforeBirthday) age -= 1
  return age
}