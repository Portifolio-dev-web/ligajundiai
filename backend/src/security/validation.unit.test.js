import { describe, expect, test } from '@jest/globals'
import { decryptSensitive, encryptSensitive, maskRg } from './crypto.js'
import { cleanText, isValidRg } from './validation.js'

describe('input and sensitive data helpers', () => {
  test('validates RG length and accepts the alphabetic check digit', () => {
    expect(isValidRg('12.345.678-9')).toBe(true)
    expect(isValidRg('12.345.678-X')).toBe(true)
    expect(isValidRg('123')).toBe(false)
    expect(isValidRg('1234567890123')).toBe(false)
  })

  test('encrypts RG with authenticated encryption and exposes only a mask', () => {
    const encrypted = encryptSensitive('123456789')
    expect(encrypted).not.toContain('123456789')
    expect(decryptSensitive(encrypted)).toBe('123456789')
    expect(maskRg(decryptSensitive(encrypted))).toBe('******789')
  })

  test('strips markup from user-controlled text', () => {
    expect(cleanText('<script>alert(1)</script><b>Equipe</b>')).toBe('alert(1)Equipe')
  })
})
