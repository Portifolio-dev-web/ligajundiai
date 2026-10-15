export const ATHLETE_POSITIONS = [
  { value: 'central', label: 'Central' },
  { value: 'ponteiro', label: 'Ponteiro' },
  { value: 'saida', label: 'Oposto / saída' },
  { value: 'levantador', label: 'Levantador' },
  { value: 'libero', label: 'Líbero' },
]

export function formatCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function isValidCpf(value) {
  const cpf = String(value ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  for (let digit = 9; digit < 11; digit += 1) {
    let sum = 0
    for (let index = 0; index < digit; index += 1) {
      sum += Number(cpf[index]) * (digit + 1 - index)
    }
    const remainder = (sum * 10) % 11
    if (Number(cpf[digit]) !== (remainder === 10 ? 0 : remainder)) return false
  }
  return true
}

export function ageFromBirthdate(value) {
  if (!value) return null
  const birthdate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(birthdate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthdate.getFullYear()
  const beforeBirthday = today.getMonth() < birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate())
  if (beforeBirthday) age -= 1
  return age
}
