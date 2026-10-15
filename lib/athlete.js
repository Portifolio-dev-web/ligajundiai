export const ATHLETE_POSITIONS = [
  { value: 'central', label: 'Central' },
  { value: 'ponteiro', label: 'Ponteiro' },
  { value: 'saida', label: 'Oposto / saída' },
  { value: 'levantador', label: 'Levantador' },
  { value: 'libero', label: 'Líbero' },
]

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value) {
  const digits = digitsOnly(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function isValidCpf(value) {
  const cpf = digitsOnly(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  for (let index = 9; index < 11; index += 1) {
    let sum = 0
    for (let digit = 0; digit < index; digit += 1) sum += Number(cpf[digit]) * (index + 1 - digit)
    const verifier = (sum * 10) % 11
    if (Number(cpf[index]) !== (verifier === 10 ? 0 : verifier)) return false
  }
  return true
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