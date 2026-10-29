import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { authenticator } from 'otplib'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import { app } from '../app.js'
import { pool } from '../db/pool.js'
import { sweepExpiredRetention } from '../services/retention.js'
import { encryptSensitive } from '../security/crypto.js'
import { initializeStorage } from '../services/storage.js'

// SEGURANÇA (varredura, item 9): createAthlete agora verifica (HeadObjectCommand) que a chave de
// biometria presignada foi realmente usada para subir um arquivo antes de aceitar o cadastro — os
// testes que só pedem a presigned URL sem nunca enviar bytes precisam fazer o upload de verdade.
async function uploadBiometryFixture(presign) {
  const form = new FormData()
  for (const [field, value] of Object.entries(presign.uploadFields)) form.append(field, value)
  form.append('file', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'foto.jpg')
  const response = await fetch(presign.uploadUrl, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Upload de biometria de teste falhou: ${response.status} ${await response.text()}`)
}

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
     VALUES ($1, 'admin', 'Admin de integração', $2, '!test-only!', $3)`,
    [id, `admin-${randomUUID()}@example.test`, process.env.CONSENT_VERSION || 'test'],
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
    await initializeStorage()
  })

  afterAll(async () => {
    await pool.query('DELETE FROM registration_periods')
    if (createdAdminJtis.length) await pool.query('DELETE FROM sessions WHERE jti = ANY($1::uuid[])', [createdAdminJtis])
    if (createdAthletes.length) await pool.query('DELETE FROM athletes WHERE id = ANY($1::uuid[])', [createdAthletes])
    if (createdTeams.length) await pool.query('DELETE FROM teams WHERE id = ANY($1::uuid[])', [createdTeams])
    // SEGURANÇA (varredura, item S15): DELETE FROM users não funciona mais para quem já tem linha
    // em audit_logs (praticamente todo mundo — registro e login já geram auditoria): a trigger nova
    // bloqueia o UPDATE que o ON DELETE SET NULL de audit_logs.actor_id tentaria fazer em cascata.
    // Isso é o comportamento correto (a trilha nunca deveria perder a referência silenciosamente) —
    // a própria aplicação só anonimiza usuários (soft delete), nunca apaga a linha; o teste segue o
    // mesmo caminho na limpeza, em vez de um DELETE que a aplicação real nunca faz.
    if (createdUsers.length) await pool.query('UPDATE users SET deleted_at = now() WHERE id = ANY($1::uuid[])', [createdUsers])
    if (createdAdminIds.length) await pool.query('UPDATE users SET deleted_at = now() WHERE id = ANY($1::uuid[])', [createdAdminIds])
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
      .send({ name: `${teamName} Fechada`, category, consent: true })
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
      .send({ name: `${teamName} Encerrada`, category, consent: true })
    expect(endedAttempt.status).toBe(403)
    expect(endedAttempt.body.error).toBe('Inscrições encerradas, te aguardamos na próxima temporada.')

    await configurePeriod(adminCookie, category, 'team')
    const allowed = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Aberta`, category, consent: true })
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
      .send({ name: teamName, category: 'Adulto Masculino', consent: true })
    expect(first.status).toBe(201)
    createdTeams.push(first.body.team.id)

    const duplicate = await request(app)
      .post('/api/teams')
      .set('Cookie', secondManager.headers['set-cookie'])
      .send({ name: teamName.toLowerCase(), category: 'Adulto Masculino', consent: true })

    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('CONFLICT')
  })

  test('returns an empty session state for an anonymous visitor', async () => {
    const response = await request(app).get('/api/auth/me')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ user: null, teams: [] })
  })

  test('allows a manager to register more than one team', async () => {
    const manager = await createManager('multi-equipe')
    const adminCookie = await createAdminSession()
    await configurePeriod(adminCookie, 'Adulto Masculino', 'team')
    await configurePeriod(adminCookie, 'Adulto Feminino', 'team')
    const first = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Multi A`, category: 'Adulto Masculino', consent: true })
    expect(first.status).toBe(201)
    createdTeams.push(first.body.team.id)

    const second = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Multi B`, category: 'Adulto Feminino', consent: true })
    expect(second.status).toBe(201)
    createdTeams.push(second.body.team.id)

    const mine = await request(app)
      .get('/api/teams/mine')
      .set('Cookie', manager.headers['set-cookie'])
    expect(mine.status).toBe(200)
    expect(mine.body.teams.map((team) => team.id)).toEqual(
      expect.arrayContaining([first.body.team.id, second.body.team.id]),
    )

    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', manager.headers['set-cookie'])
    expect(me.body.teams.map((team) => team.id)).toEqual(
      expect.arrayContaining([first.body.team.id, second.body.team.id]),
    )
  })

  test('enforces gestor then admin approval and blocks admin membership as team manager', async () => {
    const manager = await createManager('fluxo')
    const adminCookie = await createAdminSession()
    await configurePeriod(adminCookie, 'Adulto Masculino', 'team')
    await configurePeriod(adminCookie, 'Adulto Masculino', 'athlete')
    const teamResponse = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Fluxo`, category: 'Adulto Masculino', consent: true })
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
        team_id: teamId,
        name: 'Atleta de integração',
        rg: '123456789',
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
      .send({ name: `${teamName} Cadastro`, category: 'Adulto Feminino', consent: true })
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
    await uploadBiometryFixture(presign.body)

    const registration = await request(app)
      .post('/api/athletes/self-register')
      .send({
        team_id: team.id,
        name: 'Atleta de cadastro público',
        email: `atleta-${randomUUID()}@example.test`,
        password: 'Senha-Forte-Atleta-2026',
        rg: '987654321',
        age: 22,
        positions: ['levantador'],
        biometry_key: presign.body.key,
        consent: true,
        biometric_consent: true,
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

  // LGPD (varredura, item L4): a foto biométrica é dado sensível (art. 11, I) e precisa de um
  // consentimento específico, separado do aceite geral (consent) — este teste prova que o backend
  // rejeita um cadastro com foto sem esse segundo consentimento, nos dois fluxos (público e gestor).
  test('requires a specific consent for the biometric photo, separate from the general consent', async () => {
    const manager = await createManager('consentimento-biometria')
    const adminCookie = await createAdminSession()
    const teamResponse = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Biometria`, category: 'Adulto Feminino', consent: true })
    expect(teamResponse.status).toBe(201)
    const team = teamResponse.body.team
    createdTeams.push(team.id)
    const approval = await request(app)
      .post(`/api/admin/teams/${team.id}/approve`)
      .set('Cookie', adminCookie)
      .send({})
    expect(approval.status).toBe(200)

    const publicPresign = await request(app)
      .post('/api/athletes/biometry-upload-public')
      .send({ team_id: team.id, content_type: 'image/jpeg' })
    expect(publicPresign.status).toBe(201)
    await uploadBiometryFixture(publicPresign.body)

    const selfRegisterWithoutBiometricConsent = await request(app)
      .post('/api/athletes/self-register')
      .send({
        team_id: team.id,
        name: 'Atleta sem consentimento de biometria',
        email: `atleta-${randomUUID()}@example.test`,
        password: 'Senha-Forte-Atleta-2026',
        rg: '111222333',
        age: 23,
        positions: ['levantador'],
        biometry_key: publicPresign.body.key,
        consent: true,
      })
    expect(selfRegisterWithoutBiometricConsent.status).toBe(400)

    const managerPresign = await request(app)
      .post('/api/athletes/biometry-upload')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ team_id: team.id, content_type: 'image/jpeg' })
    expect(managerPresign.status).toBe(201)
    await uploadBiometryFixture(managerPresign.body)

    const gestorCreatedWithoutBiometricConsent = await request(app)
      .post('/api/athletes')
      .set('Cookie', manager.headers['set-cookie'])
      .send({
        team_id: team.id,
        name: 'Atleta do gestor sem consentimento de biometria',
        rg: '444555666',
        age: 25,
        position: 'central',
        biometry_key: managerPresign.body.key,
        consent: true,
      })
    expect(gestorCreatedWithoutBiometricConsent.status).toBe(400)
    expect(gestorCreatedWithoutBiometricConsent.body.error).toBe('É necessário o consentimento específico para o tratamento da foto biométrica')

    const gestorCreatedWithBiometricConsent = await request(app)
      .post('/api/athletes')
      .set('Cookie', manager.headers['set-cookie'])
      .send({
        team_id: team.id,
        name: 'Atleta do gestor com consentimento de biometria',
        rg: '777888999',
        age: 25,
        position: 'central',
        biometry_key: managerPresign.body.key,
        consent: true,
        biometric_consent: true,
      })
    expect(gestorCreatedWithBiometricConsent.status).toBe(201)
    createdAthletes.push(gestorCreatedWithBiometricConsent.body.athlete.id)
  })

  // SEGURANÇA (varredura, item S13): login com e-mail inexistente e login com senha errada para um
  // e-mail que existe devem falhar do mesmo jeito (401, mesma mensagem) — este teste cobre o
  // comportamento funcional; o tempo de resposta constante em si não é verificável de forma
  // confiável numa suíte de CI.
  test('rejects login the same way for an unknown e-mail and for a wrong password', async () => {
    const manager = await createManager('login-seguro')
    const unknownEmail = await request(app)
      .post('/api/auth/login-password')
      .send({ email: `nao-existe-${randomUUID()}@example.test`, password: 'qualquer-coisa-12345' })
    expect(unknownEmail.status).toBe(401)
    expect(unknownEmail.body.error).toBe('E-mail ou senha inválidos')

    const wrongPassword = await request(app)
      .post('/api/auth/login-password')
      .send({ email: manager.body.user.email, password: 'senha-errada-123456' })
    expect(wrongPassword.status).toBe(401)
    expect(wrongPassword.body.error).toBe('E-mail ou senha inválidos')

    const correctPassword = await request(app)
      .post('/api/auth/login-password')
      .send({ email: manager.body.user.email, password: 'Senha-Forte-Integracao-2026' })
    expect(correctPassword.status).toBe(200)
    expect(correctPassword.body.user.email).toBe(manager.body.user.email)
  })

  // LGPD (varredura, item L9): cadastro de atleta recusado não tem mais base legal para continuar
  // identificado — este teste recua artificialmente o updated_at (simulando o prazo de retenção já
  // vencido) e confirma que a rotina periódica anonimiza o registro, sem pedido de ninguém.
  test('retention sweep anonymizes a rejected athlete registration past the retention window', async () => {
    const manager = await createManager('retencao-recusado')
    const adminCookie = await createAdminSession()
    await configurePeriod(adminCookie, 'Adulto Masculino', 'team')
    await configurePeriod(adminCookie, 'Adulto Masculino', 'athlete')
    const teamResponse = await request(app)
      .post('/api/teams')
      .set('Cookie', manager.headers['set-cookie'])
      .send({ name: `${teamName} Retencao`, category: 'Adulto Masculino', consent: true })
    expect(teamResponse.status).toBe(201)
    const teamId = teamResponse.body.team.id
    createdTeams.push(teamId)
    const approval = await request(app)
      .post(`/api/admin/teams/${teamId}/approve`)
      .set('Cookie', adminCookie)
      .send({})
    expect(approval.status).toBe(200)

    const athleteResponse = await request(app)
      .post('/api/athletes')
      .set('Cookie', manager.headers['set-cookie'])
      .send({
        team_id: teamId,
        name: 'Atleta para teste de retenção',
        rg: '222333444',
        age: 24,
        position: 'levantador',
        consent: true,
      })
    expect(athleteResponse.status).toBe(201)
    const athleteId = athleteResponse.body.athlete.id
    createdAthletes.push(athleteId)

    const rejection = await request(app)
      .post(`/api/gestor/athletes/${athleteId}/reject`)
      .set('Cookie', manager.headers['set-cookie'])
      .send({ justification: 'Teste automatizado' })
    expect(rejection.status).toBe(200)
    expect(rejection.body.athlete.status).toBe('rejected')

    await pool.query(
      "UPDATE athletes SET updated_at = now() - interval '200 days' WHERE id = $1",
      [athleteId],
    )

    const anonymizedCount = await sweepExpiredRetention()
    expect(anonymizedCount).toBeGreaterThanOrEqual(1)

    const after = await pool.query(
      'SELECT name, rg_ciphertext, rg_hash, deleted_at FROM athletes WHERE id = $1',
      [athleteId],
    )
    expect(after.rows[0].name).toBe('Atleta anonimizado')
    expect(after.rows[0].rg_ciphertext).toBeNull()
    expect(after.rows[0].rg_hash).toBeNull()
    expect(after.rows[0].deleted_at).not.toBeNull()
  })

  // SEGURANÇA (varredura, item S15): a trilha de auditoria só serve como prova se for
  // garantidamente append-only pelo próprio banco — este teste teria passado antes da trigger
  // existir (UPDATE/DELETE funcionavam normalmente).
  test('the database itself rejects UPDATE and DELETE on audit_logs', async () => {
    const existing = await pool.query('SELECT id FROM audit_logs LIMIT 1')
    expect(existing.rowCount).toBeGreaterThan(0)
    const targetId = existing.rows[0].id

    await expect(
      pool.query("UPDATE audit_logs SET action = 'tampered' WHERE id = $1", [targetId]),
    ).rejects.toMatchObject({ message: expect.stringContaining('append-only') })

    await expect(
      pool.query('DELETE FROM audit_logs WHERE id = $1', [targetId]),
    ).rejects.toMatchObject({ message: expect.stringContaining('append-only') })

    const untouched = await pool.query('SELECT action FROM audit_logs WHERE id = $1', [targetId])
    expect(untouched.rows[0].action).not.toBe('tampered')
  })

  // LGPD (varredura, item L10): consent_version nunca era comparado com a versão atual em lugar
  // nenhum — este teste força uma versão antiga no banco (como se a política tivesse mudado depois
  // do cadastro) e confirma que login, /auth/me e /auth/reconsent refletem e corrigem isso de verdade.
  test('flags an outdated consent_version and lets the user reconsent', async () => {
    const manager = await createManager('consentimento-desatualizado')
    await pool.query("UPDATE users SET consent_version = 'versao-bem-antiga' WHERE id = $1", [manager.body.user.id])

    const login = await request(app)
      .post('/api/auth/login-password')
      .send({ email: manager.body.user.email, password: 'Senha-Forte-Integracao-2026' })
    expect(login.status).toBe(200)
    expect(login.body.user.consent_outdated).toBe(true)

    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', login.headers['set-cookie'])
    expect(me.status).toBe(200)
    expect(me.body.user.consent_outdated).toBe(true)

    const reconsent = await request(app)
      .post('/api/auth/reconsent')
      .set('Cookie', login.headers['set-cookie'])
      .send({})
    expect(reconsent.status).toBe(200)

    const meAfter = await request(app)
      .get('/api/auth/me')
      .set('Cookie', login.headers['set-cookie'])
    expect(meAfter.body.user.consent_outdated).toBe(false)

    const row = await pool.query('SELECT consent_version FROM users WHERE id = $1', [manager.body.user.id])
    expect(row.rows[0].consent_version).toBe(process.env.CONSENT_VERSION || 'test')
  })

  // SEGURANÇA (varredura, item S21): o admin precisa conseguir trocar o próprio segredo TOTP sem
  // depender de ADMIN_TOTP_SECRET/redeploy — este teste cobre o fluxo inteiro: exige o código atual
  // para começar, o segredo antigo continua válido enquanto a troca está pendente, um código errado
  // para o segredo novo não ativa nada, e só depois da confirmação o segredo antigo para de valer.
  test('lets an admin rotate their own TOTP secret with proof of possession both ways', async () => {
    const oldSecret = authenticator.generateSecret()
    const adminCookie = await createAdminSession()
    await pool.query('UPDATE users SET totp_secret_ciphertext = $2 WHERE id = $1', [latestAdminId, encryptSensitive(oldSecret)])

    const wrongStart = await request(app)
      .post('/api/auth/totp/rotate/start')
      .set('Cookie', adminCookie)
      .send({ current_totp: '000000' })
    expect(wrongStart.status).toBe(401)

    const start = await request(app)
      .post('/api/auth/totp/rotate/start')
      .set('Cookie', adminCookie)
      .send({ current_totp: authenticator.generate(oldSecret) })
    expect(start.status).toBe(200)
    const newSecret = start.body.secret
    expect(newSecret).toEqual(expect.any(String))
    expect(start.body.otpauth_url).toContain('otpauth://totp/')

    // Enquanto pendente, o segredo antigo continua sendo o válido de verdade para login.
    const stillOldSecret = await pool.query('SELECT totp_secret_ciphertext FROM users WHERE id = $1', [latestAdminId])
    expect(stillOldSecret.rows[0].totp_secret_ciphertext).not.toBeNull()

    const wrongConfirm = await request(app)
      .post('/api/auth/totp/rotate/confirm')
      .set('Cookie', adminCookie)
      .send({ new_totp: '000000' })
    expect(wrongConfirm.status).toBe(401)

    const confirm = await request(app)
      .post('/api/auth/totp/rotate/confirm')
      .set('Cookie', adminCookie)
      .send({ new_totp: authenticator.generate(newSecret) })
    expect(confirm.status).toBe(200)

    const after = await pool.query(
      'SELECT totp_secret_ciphertext, totp_pending_secret_ciphertext, totp_pending_expires_at FROM users WHERE id = $1',
      [latestAdminId],
    )
    expect(after.rows[0].totp_pending_secret_ciphertext).toBeNull()
    expect(after.rows[0].totp_pending_expires_at).toBeNull()

    // Prova fim-a-fim: o código do segredo ANTIGO não serve mais, o do NOVO serve.
    const auditLog = await pool.query(
      "SELECT action FROM audit_logs WHERE entity_type = 'user' AND entity_id = $1 AND action = 'admin.totp_rotated'",
      [latestAdminId],
    )
    expect(auditLog.rowCount).toBeGreaterThanOrEqual(1)
  })
})
