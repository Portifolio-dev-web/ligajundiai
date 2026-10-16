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
const createdAdminIds = []
const createdAdminJtis = []
let latestAdminId

async function createAdminSession() {
  const id = randomUUID()
  const adminJti = randomUUID()
  await pool.query(
    `INSERT INTO users (id, role, name, email, password_hash, consent_version)
     VALUES ($1, 'admin', 'Admin de integração', $2, '!test-only!', 'test')`,
    [id, `admin-${randomUUID()}@example.test`],
  )
  latestAdminId = id
  createdAdminIds.push(id)
  createdAdminJtis.push(adminJti)
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

async function configurePeriod(cookie, category, type, startsAt = new Date(Date.now() - 60_000), endsAt = new Date(Date.now() + 86_400_000)) {
  const response = await request(app)
    .put(`/api/admin/registration-periods/${encodeURIComponent(category)}/${type}`)
    .set('Cookie', cookie)
    .send({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
  expect(response.status).toBe(200)
  return response.body.period
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
    await pool.query('DELETE FROM registration_periods')
  })

  afterAll(async () => {
    await pool.query('DELETE FROM registration_periods')
    if (createdAdminJtis.length) await pool.query('DELETE FROM sessions WHERE jti = ANY($1::uuid[])', [createdAdminJtis])
    if (createdAthletes.length) await pool.query('DELETE FROM athletes WHERE id = ANY($1::uuid[])', [createdAthletes])
    if (createdTeams.length) await pool.query('DELETE FROM teams WHERE id = ANY($1::uuid[])', [createdTeams])
    if (createdUsers.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUsers])
    if (createdAdminIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdAdminIds])
    await pool.end()
  })

  test('keeps team registration closed until its category has an active period', async () => {
    const manager = await createManager('periodo-equipe')
    const adminCookie = await createAdminSession()
    const category = 'Sub-19 Masculino'
    const noPeriods = await request(app).get('/api/registration-periods')
    expect(noPeriods.status).toBe(200)
    expect(noPeriods.body.periods.find((period) => period.category === category && period.registration_type === 'team').status).toBe('not_configured')

    const closedAttempt = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Fechada`, category })
    expect(closedAttempt.status).toBe(403)
    expect(closedAttempt.body.error).toBe('Inscrições encerradas, te aguardamos na próxima temporada.')

    await configurePeriod(adminCookie, category, 'team', new Date(Date.now() + 86_400_000), new Date(Date.now() + 172_800_000))
    const scheduledPeriods = await request(app).get('/api/registration-periods')
    expect(scheduledPeriods.body.periods.find((period) => period.category === category && period.registration_type === 'team').status).toBe('scheduled')

    await configurePeriod(adminCookie, category, 'team', new Date(Date.now() - 172_800_000), new Date(Date.now() - 86_400_000))
    const endedPeriods = await request(app).get('/api/registration-periods')
    expect(endedPeriods.body.periods.find((period) => period.category === category && period.registration_type === 'team').status).toBe('closed')
    const endedAttempt = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Encerrada`, category })
    expect(endedAttempt.status).toBe(403)
    expect(endedAttempt.body.error).toBe('Inscrições encerradas, te aguardamos na próxima temporada.')

    await configurePeriod(adminCookie, category, 'team')
    const allowed = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Aberta`, category })
    expect(allowed.status).toBe(201)
    createdTeams.push(allowed.body.team.id)
  })

  test('rejects a second team with the same name and category with HTTP 409', async () => {
    const firstManager = await createManager('um')
    const secondManager = await createManager('dois')
    const adminCookie = await createAdminSession()
    await configurePeriod(adminCookie, 'Adulto Masculino', 'team')
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

  test('returns an empty session state for an anonymous visitor', async () => {
    const response = await request(app).get('/api/auth/me')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ user: null, team: null })
  })

  test('enforces gestor then admin approval and blocks admin membership as team manager', async () => {
    const manager = await createManager('fluxo')
    const adminCookie = await createAdminSession()
    await configurePeriod(adminCookie, 'Adulto Masculino', 'team')
    await configurePeriod(adminCookie, 'Adulto Masculino', 'athlete')
    const teamResponse = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Fluxo`, category: 'Adulto Masculino' })
    expect(teamResponse.status).toBe(201)
    const teamId = teamResponse.body.team.id
    createdTeams.push(teamId)

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
        age: 24,
        position: 'levantador',
        consent: true,
      })
    expect(athleteResponse.status).toBe(201)
    const athleteId = athleteResponse.body.athlete.id
    createdAthletes.push(athleteId)
    expect(athleteResponse.body.athlete.age_at_registration).toBe(24)
    const managerQueue = await request(app)
      .get('/api/gestor/athletes?status=awaiting_manager')
      .set('Cookie', manager.headers['set-cookie'])
    expect(managerQueue.status).toBe(200)
    expect(managerQueue.body.athletes.map((athlete) => athlete.id)).toContain(athleteId)

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
      [`Admin team ${randomUUID()}`, 'Adulto Masculino', latestAdminId],
    )).rejects.toMatchObject({ code: '23514' })
  })

  test('allows public athlete registration only for approved teams', async () => {
    const manager = await createManager('cadastro-publico')
    const adminCookie = await createAdminSession()
    await configurePeriod(adminCookie, 'Adulto Feminino', 'team')
    const teamResponse = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Cadastro`, category: 'Adulto Feminino' })
    expect(teamResponse.status).toBe(201)
    const team = teamResponse.body.team
    createdTeams.push(team.id)

    const beforeApproval = await request(app).get('/api/approved-teams')
    expect(beforeApproval.status).toBe(200)
    expect(beforeApproval.body.teams.map((item) => item.id)).not.toContain(team.id)
    const pendingPresign = await request(app)
      .post('/api/athletes/biometry-upload-public')
      .send({ team_id: team.id, content_type: 'image/jpeg' })
    expect(pendingPresign.status).toBe(400)

    const approval = await request(app)
      .post(`/api/admin/teams/${team.id}/approve`)
      .set('Cookie', adminCookie)
      .send({})
    expect(approval.status).toBe(200)

    const approvedTeams = await request(app).get('/api/approved-teams')
    expect(approvedTeams.body.teams.map((item) => item.id)).not.toContain(team.id)

    const closedPresign = await request(app)
      .post('/api/athletes/biometry-upload-public')
      .send({ team_id: team.id, content_type: 'image/jpeg' })
    expect(closedPresign.status).toBe(403)
    expect(closedPresign.body.error).toBe('Obrigado pelo interesse em participar, Cadastro encerrado.')

    await configurePeriod(adminCookie, 'Adulto Feminino', 'athlete')
    const reopenedTeams = await request(app).get('/api/approved-teams')
    expect(reopenedTeams.body.teams.map((item) => item.id)).toContain(team.id)

    const presign = await request(app)
      .post('/api/athletes/biometry-upload-public')
      .send({ team_id: team.id, content_type: 'image/jpeg' })
    expect(presign.status).toBe(201)
    expect(presign.body.key).toMatch(new RegExp(`^biometry/${team.manager_user_id}/`))

    const registration = await request(app)
      .post('/api/athletes/self-register')
      .send({
        team_id: team.id,
        name: 'Atleta de cadastro público',
        email: `atleta-${randomUUID()}@example.test`,
        password: 'Senha-Forte-Atleta-2026',
        cpf: '529.982.247-25',
        age: 22,
        positions: ['levantador'],
        biometry_key: presign.body.key,
        consent: true,
      })

    expect(registration.status).toBe(201)
    expect(registration.body.user.role).toBe('atleta')
    expect(registration.body.athlete.status).toBe('awaiting_manager')
    expect(registration.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('lvj_session=')]),
    )
    createdUsers.push(registration.body.user.id)
    createdAthletes.push(registration.body.athlete.id)

    const managerQueue = await request(app)
      .get('/api/gestor/athletes?status=awaiting_manager')
      .set('Cookie', manager.headers['set-cookie'])
    expect(managerQueue.body.athletes.map((athlete) => athlete.id)).toContain(registration.body.athlete.id)

    const athleteProfile = await request(app)
      .get('/api/athletes/me')
      .set('Cookie', registration.headers['set-cookie'])
    expect(athleteProfile.status).toBe(200)
    expect(athleteProfile.body.athletes.map((athlete) => athlete.id)).toContain(registration.body.athlete.id)
  })
})
