import { randomUUID } from 'node:crypto'
import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { query } from '../db/pool.js'
import { config } from '../config.js'
import { AppError, forbidden, unauthorized } from '../errors.js'

export const sessionCookieName = 'lvj_session'
const sessionDurationSeconds = 60 * 60 * 8

export async function createSession(user, res) {
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000)
  const token = jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: sessionDurationSeconds,
    issuer: 'ligajundiai-api',
    audience: 'ligajundiai-web',
    jwtid: jti,
  })
  await query('INSERT INTO sessions (jti, user_id, expires_at) VALUES ($1, $2, $3)', [jti, user.id, expiresAt])
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionDurationSeconds * 1000,
  })
}

export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[sessionCookieName]
    if (!token) throw unauthorized()
    let payload
    try {
      payload = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'ligajundiai-api',
        audience: 'ligajundiai-web',
      })
    } catch {
      throw unauthorized('Sessão inválida ou expirada')
    }
    const result = await query(
      `SELECT u.id, u.role, u.name, u.email, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.jti = $1 AND s.user_id = $2 AND s.revoked_at IS NULL
         AND s.expires_at > now() AND u.status = 'active' AND u.deleted_at IS NULL`,
      [payload.jti, payload.sub],
    )
    if (!result.rowCount) throw unauthorized('Sessão revogada ou expirada')
    req.user = result.rows[0]
    req.sessionJti = payload.jti
    next()
  } catch (error) {
    next(error)
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export async function verifyUserPassword(user, password) {
  if (user.legacy_password_salt && user.legacy_password_hash) {
    try {
      const supplied = scryptSync(String(password), user.legacy_password_salt, 64)
      const expected = Buffer.from(user.legacy_password_hash, 'hex')
      return expected.length === supplied.length && timingSafeEqual(expected, supplied)
    } catch {
      return false
    }
  }
  return verifyPassword(user.password_hash, password)
}

export function unusablePasswordHash() {
  return `!migrated-otp-only:${randomBytes(24).toString('hex')}`
}

export async function revokeSession(req, res) {
  if (req.sessionJti) await query('UPDATE sessions SET revoked_at = now() WHERE jti = $1 AND revoked_at IS NULL', [req.sessionJti])
  res.clearCookie(sessionCookieName, { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', path: '/' })
}

export function requireTotp(value) {
  if (!value) throw new AppError(401, 'TOTP_REQUIRED', 'Informe o código de autenticação de dois fatores')
}

export { sessionDurationSeconds }
