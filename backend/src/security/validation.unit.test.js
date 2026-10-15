import { describe, expect, test } from '@jest/globals'
import { decryptSensitive, encryptSensitive, maskCpf } from './crypto.js'
import { cleanText, isValidCpf } from './validation.js'

describe('input and sensitive data helpers', () => {
  test('validates CPF check digits and rejects repeated digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('529.982.247-24')).toBe(false)
  })

  test('encrypts CPF with authenticated encryption and exposes only a mask', () => {
    const encrypted = encryptSensitive('52998224725')
    expect(encrypted).not.toContain('52998224725')
    expect(decryptSensitive(encrypted)).toBe('52998224725')
    expect(maskCpf(decryptSensitive(encrypted))).toBe('***.***.247-25')
  })

  test('strips markup from user-controlled text', () => {
    expect(cleanText('<script>alert(1)</script><b>Equipe</b>')).toBe('alert(1)Equipe')
  })
})
