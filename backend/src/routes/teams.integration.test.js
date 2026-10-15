import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import { app } from '../app.js'
import { pool } from '../db/pool.js'

const migrationPath = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url))
const teamName = `Integracao ${randomUUID()}`
const createdUsers = []
const createdTeams = []
const createdAthletes = []
let adminId
let adminJti

async function createAdminSession() {
  const id = randomUUID()
  adminJti = randomUUID()
  await pool.query(
    `INSERT INTO users (id, role, name, email, password_hash, consent_version)
     VALUES ($1, 'admin', 'Admin de integração', $2, '!test-only!', 'test')`,
    [id, `admin-${randomUUID()}@example.test`],
  )
  adminId = id
  const token = jwt.sign({ sub: id, role: 'admin' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: 3600,
    issuer: 'ligajundiai-api',
    audience: 'ligajundiai-web',
    jwtid: adminJti,
  })
  await pool.query(
    'INSERT INTO sessions (jti, user_id, expires_at) VALUES ($1, $2, now() + interval \'1 hour\')',
    [adminJti, id],
  )
  return `lvj_session=${token}`
}

async function createManager(suffix) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: `Gestor ${suffix}`,
      email: `gestor-${suffix}-${randomUUID()}@example.test`,
      password: 'Senha-Forte-Integracao-2026',
      consent: true,
    })
  expect(response.status).toBe(201)
  createdUsers.push(response.body.user.id)
  return response
}

describe('team creation constraints', () => {
  beforeAll(async () => {
    await pool.query(await readFile(migrationPath, 'utf8'))
  })

  afterAll(async () => {
    if (adminJti) await pool.query('DELETE FROM sessions WHERE jti = $1', [adminJti])
    if (createdAthletes.length) await pool.query('DELETE FROM athletes WHERE id = ANY($1::uuid[])', [createdAthletes])
    if (createdTeams.length) await pool.query('DELETE FROM teams WHERE id = ANY($1::uuid[])', [createdTeams])
    if (createdUsers.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUsers])
    if (adminId) await pool.query('DELETE FROM users WHERE id = $1', [adminId])
    await pool.end()
  })

  test('rejects a second team with the same name and category with HTTP 409', async () => {
    const firstManager = await createManager('um')
    const secondManager = await createManager('dois')
    const first = await request(app)
      .post('/api/teams')
      .set('Cookie', firstManager.headers['set-cookie'])
      .send({ name: teamName, category: 'Adulto Masculino' })
    expect(first.status).toBe(201)
    createdTeams.push(first.body.team.id)

    const duplicate = await request(app)
      .post('/api/teams')
      .set('Cookie', secondManager.headers['set-cookie'])
      .send({ name: teamName.toLowerCase(), category: 'Adulto Masculino' })

    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('CONFLICT')
  })

  test('registers athlete accounts with the athlete role and an authenticated session', async () => {
    const response = await request(app)
      .post('/api/auth/register-athlete')
      .send({
        name: 'Atleta de integração',
        email: `atleta-${randomUUID()}@example.test`,
        password: 'Senha-Forte-Integracao-2026',
        consent: true,
      })

    expect(response.status).toBe(201)
    expect(response.body.user.role).toBe('atleta')
    expect(response.headers['set-cookie']).toBeDefined()
    createdUsers.push(response.body.user.id)

    const session = await request(app)
      .get('/api/auth/me')
      .set('Cookie', response.headers['set-cookie'])

    expect(session.status).toBe(200)
    expect(session.body.user.role).toBe('atleta')
    expect(session.body.team).toBeNull()
  })

  test('enforces gestor then admin approval and blocks admin membership as team manager', async () => {
    const manager = await createManager('fluxo')
    const teamResponse = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Fluxo`, category: 'Adulto Masculino' })
    expect(teamResponse.status).toBe(201)
    const teamId = teamResponse.body.team.id
    createdTeams.push(teamId)

    const adminCookie = await createAdminSession()
    const teamApproval = await request(app)
      .post(`/api/admin/teams/${teamId}/approve`)
      .set('Cookie', adminCookie)
      .send({})
    expect(teamApproval.status).toBe(200)

    const athleteResponse = await request(app)
      .post('/api/athletes')
      .set('Cookie', manager.headers['set-cookie'])
      .send({
        name: 'Atleta de integração',
        cpf: '529.982.247-25',
        position: 'levantador',
        consent: true,
      })
    expect(athleteResponse.status).toBe(201)
    const athleteId = athleteResponse.body.athlete.id
    createdAthletes.push(athleteId)

    const adminBeforeManager = await request(app)
      .post(`/api/admin/athletes/${athleteId}/approve`)
      .set('Cookie', adminCookie)
      .send({})
    expect(adminBeforeManager.status).toBe(409)

    const managerApproval = await request(app)
      .post(`/api/gestor/athletes/${athleteId}/approve`)
      .set('Cookie', manager.headers['set-cookie'])
      .send({})
    expect(managerApproval.status).toBe(200)
    expect(managerApproval.body.athlete.status).toBe('awaiting_admin')

    const finalApproval = await request(app)
      .post(`/api/admin/athletes/${athleteId}/approve`)
      .set('Cookie', adminCookie)
      .send({})
    expect(finalApproval.status).toBe(200)
    expect(finalApproval.body.athlete.status).toBe('approved')

    await expect(pool.query(
      'INSERT INTO teams (name, category, manager_user_id) VALUES ($1, $2, $3)',
      [`Admin team ${randomUUID()}`, 'Adulto Masculino', adminId],
    )).rejects.toMatchObject({ code: '23514' })
  })
})
