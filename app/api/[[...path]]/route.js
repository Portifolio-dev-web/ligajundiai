import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ----------------------------------------------------------------------------
// MongoDB connection (singleton)
// ----------------------------------------------------------------------------
let client
let db
let seeded = false

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  if (!seeded) {
    await ensureSeed(db)
    seeded = true
  }
  return db
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const CATEGORIES = [
  'Adulto Masculino',
  'Adulto Feminino',
  'Master Masculino',
  'Master Feminino',
  'Sub-19 Masculino',
  'Sub-19 Feminino',
]

const DEFAULT_RULES = {
  id: 'league_rules',
  points: { win_3_0: 3, win_3_1: 3, win_3_2: 2, loss_3_2: 1, loss_3_1: 0, loss_3_0: 0 },
  tiebreakers: ['points', 'wins', 'sets_ratio', 'points_ratio'],
  min_attendance_percent: 70,
  updated_at: new Date(),
}

// ----------------------------------------------------------------------------
// Crypto helpers
// ----------------------------------------------------------------------------
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return { salt, hash }
}
function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false
  const h = crypto.scryptSync(String(password), salt, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash))
  } catch {
    return false
  }
}
function genToken() {
  return crypto.randomBytes(32).toString('hex')
}
function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ----------------------------------------------------------------------------
// Seed
// ----------------------------------------------------------------------------
async function ensureSeed(database) {
  // Rules
  const r = await database.collection('rules').findOne({ id: 'league_rules' })
  if (!r) {
    await database.collection('rules').insertOne({ ...DEFAULT_RULES })
  }
  // Admin
  const admin = await database.collection('users').findOne({ role: 'admin' })
  if (!admin) {
    const { salt, hash } = hashPassword('admin123')
    await database.collection('users').insertOne({
      id: uuidv4(),
      name: 'Administrador LVJ',
      email: 'admin@lvj.com',
      phone: '11999990000',
      cpf: '00000000000',
      role: 'admin',
      status: 'active',
      password_salt: salt,
      password_hash: hash,
      created_at: new Date(),
    })
  }
  // Sponsors
  const sponsorCount = await database.collection('sponsors').countDocuments()
  if (sponsorCount === 0) {
    await database.collection('sponsors').insertMany([
      { id: uuidv4(), name: 'Jundiaí Esportes', logo_url: '', website: 'https://example.com', tier: 'ouro', active: true },
      { id: uuidv4(), name: 'Rede Vôlei Sports', logo_url: '', website: 'https://example.com', tier: 'prata', active: true },
      { id: uuidv4(), name: 'Academia PowerFit', logo_url: '', website: 'https://example.com', tier: 'bronze', active: true },
      { id: uuidv4(), name: 'Padaria do Centro', logo_url: '', website: 'https://example.com', tier: 'apoio', active: true },
    ])
  }
}

// ----------------------------------------------------------------------------
// Response helpers
// ----------------------------------------------------------------------------
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}
function json(data, status = 200) {
  return handleCORS(NextResponse.json(data, { status }))
}
function clean(obj) {
  if (!obj) return obj
  const { _id, password_hash, password_salt, ...rest } = obj
  return rest
}

// ----------------------------------------------------------------------------
// Auth helpers
// ----------------------------------------------------------------------------
async function getUser(request, database) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  const s = await database.collection('sessions').findOne({ token })
  if (!s || new Date(s.expires_at) < new Date()) return null
  const u = await database.collection('users').findOne({ id: s.user_id })
  return u || null
}

async function createSession(database, userId) {
  const token = genToken()
  const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  await database.collection('sessions').insertOne({ token, user_id: userId, expires_at })
  return token
}

// ----------------------------------------------------------------------------
// Business helpers
// ----------------------------------------------------------------------------
async function getRules(database) {
  const r = await database.collection('rules').findOne({ id: 'league_rules' })
  return r || DEFAULT_RULES
}

async function addLog(database, actor, action, entity_type, entity_id, metadata = {}) {
  await database.collection('logs').insertOne({
    id: uuidv4(),
    actor_id: actor?.id || null,
    actor_name: actor?.name || 'sistema',
    action,
    entity_type,
    entity_id,
    metadata,
    created_at: new Date(),
  })
}

async function addNotification(database, target, type, title, body) {
  await database.collection('notifications').insertOne({
    id: uuidv4(),
    target, // 'admin' or user_id
    type,
    title,
    body,
    read: false,
    created_at: new Date(),
  })
}

// MOCKED email sender - stores email content (ready to plug Resend)
async function sendEmailMock(database, { to, subject, html, type, event_id }) {
  const record = {
    id: uuidv4(),
    to,
    subject,
    html,
    type,
    event_id: event_id || uuidv4(),
    status: 'MOCKED_SENT',
    created_at: new Date(),
  }
  await database.collection('email_log').insertOne(record)
  return clean(record)
}

async function computeStandings(database, category) {
  const teams = await database.collection('teams').find({ category, status: 'approved' }).toArray()
  const rules = await getRules(database)
  const stats = {}
  teams.forEach((t) => {
    stats[t.id] = {
      team_id: t.id,
      name: t.name,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      sets_won: 0,
      sets_lost: 0,
      rally_for: 0,
      rally_against: 0,
    }
  })
  const matches = await database
    .collection('matches')
    .find({ category, status: 'finished' })
    .toArray()

  for (const m of matches) {
    const H = stats[m.home_team_id]
    const A = stats[m.away_team_id]
    if (!H || !A) continue
    let hs = 0
    let as = 0
    let rfH = 0
    let rfA = 0
    ;(m.sets || []).forEach((s) => {
      const sh = Number(s.home) || 0
      const sa = Number(s.away) || 0
      if (sh > sa) hs++
      else if (sa > sh) as++
      rfH += sh
      rfA += sa
    })
    H.played++
    A.played++
    H.sets_won += hs
    H.sets_lost += as
    A.sets_won += as
    A.sets_lost += hs
    H.rally_for += rfH
    H.rally_against += rfA
    A.rally_for += rfA
    A.rally_against += rfH

    const winnerSets = Math.max(hs, as)
    const loserSets = Math.min(hs, as)
    const type = `${winnerSets}x${loserSets}`
    const p = rules.points || DEFAULT_RULES.points
    const winMap = { '3x0': p.win_3_0, '3x1': p.win_3_1, '3x2': p.win_3_2 }
    const loseMap = { '3x0': p.loss_3_0, '3x1': p.loss_3_1, '3x2': p.loss_3_2 }
    const winPts = winMap[type] ?? 0
    const losePts = loseMap[type] ?? 0
    const homeWon = hs > as
    if (homeWon) {
      H.wins++
      A.losses++
      H.points += winPts
      A.points += losePts
    } else {
      A.wins++
      H.losses++
      A.points += winPts
      H.points += losePts
    }
  }

  let arr = Object.values(stats).map((s) => ({
    ...s,
    sets_ratio: s.sets_lost ? +(s.sets_won / s.sets_lost).toFixed(3) : s.sets_won,
    points_ratio: s.rally_against ? +(s.rally_for / s.rally_against).toFixed(3) : s.rally_for,
  }))

  const tiebreakers = rules.tiebreakers || DEFAULT_RULES.tiebreakers
  arr.sort((a, b) => {
    for (const key of tiebreakers) {
      const av = a[key] ?? 0
      const bv = b[key] ?? 0
      if (bv !== av) return bv - av
    }
    return a.name.localeCompare(b.name)
  })

  return arr.map((s, i) => ({ position: i + 1, ...s }))
}

async function computeTeamAttendance(database, teamId) {
  const rules = await getRules(database)
  const min = rules.min_attendance_percent || 0
  const athletes = await database
    .collection('athletes')
    .find({ team_id: teamId, status: 'approved' })
    .toArray()
  const result = []
  for (const a of athletes) {
    const total = await database.collection('attendance').countDocuments({ athlete_id: a.id })
    const present = await database
      .collection('attendance')
      .countDocuments({ athlete_id: a.id, present: true })
    const percent = total ? +((present / total) * 100).toFixed(1) : 0
    result.push({
      athlete_id: a.id,
      name: a.name,
      cpf: a.cpf,
      total_sessions: total,
      present,
      percent,
      min_required: min,
      eligible: percent >= min,
    })
  }
  return result
}

// ----------------------------------------------------------------------------
// OPTIONS
// ----------------------------------------------------------------------------
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// ----------------------------------------------------------------------------
// Main router
// ----------------------------------------------------------------------------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const seg = path
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const database = await connectToMongo()
    const url = new URL(request.url)

    // -------------------- ROOT --------------------
    if ((route === '/' || route === '/root') && method === 'GET') {
      return json({ message: 'LVJ API online', app: 'Liga de Voleibol Jundiaí' })
    }

    // -------------------- PUBLIC --------------------
    if (route === '/categories' && method === 'GET') {
      return json({ categories: CATEGORIES })
    }

    if (route === '/sponsors' && method === 'GET') {
      const sponsors = await database.collection('sponsors').find({ active: true }).toArray()
      return json({ sponsors: sponsors.map(clean) })
    }

    if (route === '/standings' && method === 'GET') {
      const category = url.searchParams.get('category') || CATEGORIES[0]
      const standings = await computeStandings(database, category)
      return json({ category, standings })
    }

    if (route === '/matches' && method === 'GET') {
      const category = url.searchParams.get('category')
      const status = url.searchParams.get('status')
      const q = {}
      if (category) q.category = category
      if (status) q.status = status
      const matches = await database
        .collection('matches')
        .find(q)
        .sort({ scheduled_at: 1 })
        .toArray()
      return json({ matches: matches.map(clean) })
    }

    // -------------------- AUTH --------------------
    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      const { name, email, phone, cpf, password } = body
      if (!name || !email) return json({ error: 'Nome e e-mail são obrigatórios' }, 400)
      const emailLower = String(email).trim().toLowerCase()
      const exists = await database.collection('users').findOne({ email: emailLower })
      if (exists) return json({ error: 'Este e-mail já está cadastrado' }, 400)
      const user = {
        id: uuidv4(),
        name,
        email: emailLower,
        phone: phone || '',
        cpf: cpf || '',
        role: 'gestor',
        status: 'active',
        created_at: new Date(),
      }
      if (password) {
        const { salt, hash } = hashPassword(password)
        user.password_salt = salt
        user.password_hash = hash
      }
      await database.collection('users').insertOne(user)
      const token = await createSession(database, user.id)
      await addLog(database, user, 'user_register', 'user', user.id, { role: 'gestor' })
      return json({ token, user: clean(user) })
    }

    if (route === '/auth/login-password' && method === 'POST') {
      const body = await request.json()
      const emailLower = String(body.email || '').trim().toLowerCase()
      const u = await database.collection('users').findOne({ email: emailLower })
      if (!u || !verifyPassword(body.password, u.password_salt, u.password_hash)) {
        return json({ error: 'E-mail ou senha inválidos' }, 401)
      }
      const token = await createSession(database, u.id)
      return json({ token, user: clean(u) })
    }

    if (route === '/auth/otp/request' && method === 'POST') {
      const body = await request.json()
      const emailLower = String(body.email || '').trim().toLowerCase()
      if (!emailLower) return json({ error: 'E-mail é obrigatório' }, 400)
      let u = await database.collection('users').findOne({ email: emailLower })
      // auto-create gestor if not exists (passwordless signup)
      if (!u) {
        u = {
          id: uuidv4(),
          name: body.name || emailLower.split('@')[0],
          email: emailLower,
          phone: body.phone || '',
          cpf: body.cpf || '',
          role: 'gestor',
          status: 'active',
          created_at: new Date(),
        }
        await database.collection('users').insertOne(u)
      }
      const code = genOTP()
      await database.collection('otps').insertOne({
        id: uuidv4(),
        email: emailLower,
        code,
        expires_at: new Date(Date.now() + 1000 * 60 * 10),
        used: false,
      })
      // MOCKED email delivery
      await sendEmailMock(database, {
        to: emailLower,
        subject: 'Seu código de acesso - Liga de Voleibol Jundiaí',
        html: `<p>Seu código de acesso é: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
        type: 'otp_login',
      })
      // For testing (no real email provider), the code is returned as dev_code
      return json({ ok: true, message: 'Código enviado por e-mail (MOCKED)', dev_code: code })
    }

    if (route === '/auth/otp/verify' && method === 'POST') {
      const body = await request.json()
      const emailLower = String(body.email || '').trim().toLowerCase()
      const code = String(body.code || '').trim()
      const otp = await database
        .collection('otps')
        .findOne({ email: emailLower, code, used: false }, { sort: { expires_at: -1 } })
      if (!otp || new Date(otp.expires_at) < new Date()) {
        return json({ error: 'Código inválido ou expirado' }, 401)
      }
      await database.collection('otps').updateOne({ id: otp.id }, { $set: { used: true } })
      const u = await database.collection('users').findOne({ email: emailLower })
      if (!u) return json({ error: 'Usuário não encontrado' }, 404)
      const token = await createSession(database, u.id)
      return json({ token, user: clean(u) })
    }

    if (route === '/auth/me' && method === 'GET') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      let team = null
      if (u.role === 'gestor') {
        team = await database.collection('teams').findOne({ manager_user_id: u.id })
      }
      return json({ user: clean(u), team: clean(team) })
    }

    if (route === '/auth/logout' && method === 'POST') {
      const authHeader = request.headers.get('authorization') || ''
      const token = authHeader.replace('Bearer ', '').trim()
      if (token) await database.collection('sessions').deleteOne({ token })
      return json({ ok: true })
    }

    // -------------------- GESTOR: TEAMS --------------------
    if (route === '/teams' && method === 'POST') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      const body = await request.json()
      if (!body.name || !body.category) return json({ error: 'Nome e categoria obrigatórios' }, 400)
      const existing = await database.collection('teams').findOne({ manager_user_id: u.id })
      if (existing) return json({ error: 'Você já possui uma equipe cadastrada' }, 400)
      const team = {
        id: uuidv4(),
        name: body.name,
        category: body.category,
        manager_user_id: u.id,
        manager_name: u.name,
        manager_email: u.email,
        status: 'pending',
        justification: '',
        created_at: new Date(),
      }
      await database.collection('teams').insertOne(team)
      await addNotification(
        database,
        'admin',
        'team_pending',
        'Nova equipe aguardando aprovação',
        `A equipe "${team.name}" (${team.category}) foi cadastrada por ${u.name}.`
      )
      await addLog(database, u, 'team_request', 'team', team.id, { name: team.name })
      return json({ team: clean(team) })
    }

    if (route === '/teams/mine' && method === 'GET') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      const team = await database.collection('teams').findOne({ manager_user_id: u.id })
      return json({ team: clean(team) })
    }

    // -------------------- GESTOR: ATHLETES --------------------
    if (route === '/athletes' && method === 'POST') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      const body = await request.json()
      const team = await database.collection('teams').findOne({ manager_user_id: u.id })
      if (!team) return json({ error: 'Cadastre sua equipe primeiro' }, 400)
      if (team.status !== 'approved')
        return json({ error: 'Sua equipe precisa ser aprovada antes de cadastrar atletas' }, 400)
      if (!body.name || !body.cpf) return json({ error: 'Nome e CPF são obrigatórios' }, 400)
      const athlete = {
        id: uuidv4(),
        name: body.name,
        cpf: String(body.cpf).replace(/\D/g, ''),
        birthdate: body.birthdate || '',
        position: body.position || '',
        team_id: team.id,
        team_name: team.name,
        category: team.category,
        manager_user_id: u.id,
        status: 'pending',
        justification: '',
        created_at: new Date(),
      }
      await database.collection('athletes').insertOne(athlete)
      await addNotification(
        database,
        'admin',
        'athlete_pending',
        'Novo atleta aguardando liberação',
        `O atleta "${athlete.name}" foi cadastrado na equipe "${team.name}".`
      )
      await addLog(database, u, 'athlete_add', 'athlete', athlete.id, { name: athlete.name })
      return json({ athlete: clean(athlete) })
    }

    if (route === '/athletes/mine' && method === 'GET') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      const team = await database.collection('teams').findOne({ manager_user_id: u.id })
      if (!team) return json({ athletes: [] })
      const athletes = await database
        .collection('athletes')
        .find({ team_id: team.id })
        .sort({ created_at: -1 })
        .toArray()
      return json({ athletes: athletes.map(clean) })
    }

    // Athlete history by CPF (cross team/category)
    if (seg[0] === 'athletes' && seg[1] === 'cpf' && seg[2] && method === 'GET') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      const cpf = String(seg[2]).replace(/\D/g, '')
      const regs = await database.collection('athletes').find({ cpf }).toArray()
      return json({ cpf, registrations: regs.map(clean) })
    }

    if (route === '/attendance/mine' && method === 'GET') {
      const u = await getUser(request, database)
      if (!u) return json({ error: 'Não autenticado' }, 401)
      const team = await database.collection('teams').findOne({ manager_user_id: u.id })
      if (!team) return json({ attendance: [], team: null })
      const attendance = await computeTeamAttendance(database, team.id)
      return json({ attendance, team: clean(team) })
    }

    // -------------------- ADMIN --------------------
    async function requireAdmin() {
      const u = await getUser(request, database)
      if (!u) return { error: json({ error: 'Não autenticado' }, 401) }
      if (u.role !== 'admin') return { error: json({ error: 'Acesso restrito ao administrador' }, 403) }
      return { user: u }
    }

    if (route === '/rules' && method === 'GET') {
      const rules = await getRules(database)
      return json({ rules: clean(rules) })
    }

    if (route === '/rules' && method === 'PUT') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const body = await request.json()
      const update = {
        points: body.points,
        tiebreakers: body.tiebreakers,
        min_attendance_percent: Number(body.min_attendance_percent),
        updated_at: new Date(),
      }
      await database
        .collection('rules')
        .updateOne({ id: 'league_rules' }, { $set: update }, { upsert: true })
      await addLog(database, user, 'rules_update', 'rules', 'league_rules', update)
      const rules = await getRules(database)
      return json({ rules: clean(rules) })
    }

    if (route === '/admin/notifications' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const pending_teams = await database.collection('teams').countDocuments({ status: 'pending' })
      const pending_athletes = await database
        .collection('athletes')
        .countDocuments({ status: 'pending' })
      const items = await database
        .collection('notifications')
        .find({ target: 'admin' })
        .sort({ created_at: -1 })
        .limit(50)
        .toArray()
      const unread = items.filter((i) => !i.read).length
      return json({ pending_teams, pending_athletes, unread, items: items.map(clean) })
    }

    if (seg[0] === 'admin' && seg[1] === 'notifications' && seg[3] === 'read' && method === 'POST') {
      const { error } = await requireAdmin()
      if (error) return error
      await database
        .collection('notifications')
        .updateOne({ id: seg[2] }, { $set: { read: true } })
      return json({ ok: true })
    }

    if (route === '/admin/notifications/read-all' && method === 'POST') {
      const { error } = await requireAdmin()
      if (error) return error
      await database
        .collection('notifications')
        .updateMany({ target: 'admin', read: false }, { $set: { read: true } })
      return json({ ok: true })
    }

    // Admin: list teams
    if (route === '/admin/teams' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const status = url.searchParams.get('status')
      const q = status ? { status } : {}
      const teams = await database
        .collection('teams')
        .find(q)
        .sort({ created_at: -1 })
        .toArray()
      return json({ teams: teams.map(clean) })
    }

    // Admin: approve/reject team
    if (seg[0] === 'admin' && seg[1] === 'teams' && seg[3] && method === 'POST') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const teamId = seg[2]
      const action = seg[3] // approve | reject
      const body = await request.json().catch(() => ({}))
      const team = await database.collection('teams').findOne({ id: teamId })
      if (!team) return json({ error: 'Equipe não encontrada' }, 404)
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const justification = action === 'reject' ? body.justification || 'Sem justificativa informada' : ''
      await database
        .collection('teams')
        .updateOne({ id: teamId }, { $set: { status: newStatus, justification } })
      // Email (MOCKED) to manager
      const subject =
        action === 'approve'
          ? `Equipe "${team.name}" APROVADA - LVJ`
          : `Equipe "${team.name}" RECUSADA - LVJ`
      const html =
        action === 'approve'
          ? `<p>Olá ${team.manager_name},</p><p>Sua equipe <strong>${team.name}</strong> (${team.category}) foi <strong>APROVADA</strong> na Liga de Voleibol Jundiaí. Você já pode cadastrar seus atletas.</p>`
          : `<p>Olá ${team.manager_name},</p><p>Sua equipe <strong>${team.name}</strong> foi <strong>RECUSADA</strong>.</p><p><strong>Justificativa:</strong> ${justification}</p>`
      await sendEmailMock(database, {
        to: team.manager_email,
        subject,
        html,
        type: `team_${action}`,
        event_id: `team-${action}-${teamId}`,
      })
      // notify manager
      await addNotification(
        database,
        team.manager_user_id,
        `team_${action}`,
        subject,
        action === 'approve'
          ? 'Sua equipe foi aprovada!'
          : `Sua equipe foi recusada. Motivo: ${justification}`
      )
      await addLog(database, user, `team_${action}`, 'team', teamId, { justification })
      const updated = await database.collection('teams').findOne({ id: teamId })
      return json({ team: clean(updated), email_sent_mock: true })
    }

    // Admin: list athletes
    if (route === '/admin/athletes' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const status = url.searchParams.get('status')
      const q = status ? { status } : {}
      const athletes = await database
        .collection('athletes')
        .find(q)
        .sort({ created_at: -1 })
        .toArray()
      return json({ athletes: athletes.map(clean) })
    }

    // Admin: approve/reject athlete
    if (seg[0] === 'admin' && seg[1] === 'athletes' && seg[3] && method === 'POST') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const athleteId = seg[2]
      const action = seg[3]
      const body = await request.json().catch(() => ({}))
      const athlete = await database.collection('athletes').findOne({ id: athleteId })
      if (!athlete) return json({ error: 'Atleta não encontrado' }, 404)
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const justification = action === 'reject' ? body.justification || 'Sem justificativa informada' : ''
      await database
        .collection('athletes')
        .updateOne({ id: athleteId }, { $set: { status: newStatus, justification } })
      const manager = await database.collection('users').findOne({ id: athlete.manager_user_id })
      if (manager) {
        const subject =
          action === 'approve'
            ? `Atleta "${athlete.name}" LIBERADO - LVJ`
            : `Atleta "${athlete.name}" RECUSADO - LVJ`
        const html =
          action === 'approve'
            ? `<p>Olá ${manager.name},</p><p>O atleta <strong>${athlete.name}</strong> foi <strong>LIBERADO</strong> para a equipe ${athlete.team_name}.</p>`
            : `<p>Olá ${manager.name},</p><p>O atleta <strong>${athlete.name}</strong> foi <strong>RECUSADO</strong>.</p><p><strong>Justificativa:</strong> ${justification}</p>`
        await sendEmailMock(database, {
          to: manager.email,
          subject,
          html,
          type: `athlete_${action}`,
          event_id: `athlete-${action}-${athleteId}`,
        })
        await addNotification(database, manager.id, `athlete_${action}`, subject, html.replace(/<[^>]+>/g, ' '))
      }
      await addLog(database, user, `athlete_${action}`, 'athlete', athleteId, { justification })
      const updated = await database.collection('athletes').findOne({ id: athleteId })
      return json({ athlete: clean(updated), email_sent_mock: true })
    }

    // Admin: teams for a category (for scheduling)
    if (route === '/admin/teams-approved' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const category = url.searchParams.get('category')
      const q = { status: 'approved' }
      if (category) q.category = category
      const teams = await database.collection('teams').find(q).toArray()
      return json({ teams: teams.map(clean) })
    }

    // Admin: create match
    if (route === '/admin/matches' && method === 'POST') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const body = await request.json()
      const home = await database.collection('teams').findOne({ id: body.home_team_id })
      const away = await database.collection('teams').findOne({ id: body.away_team_id })
      if (!home || !away) return json({ error: 'Equipes inválidas' }, 400)
      const match = {
        id: uuidv4(),
        category: home.category,
        round: body.round || '',
        home_team_id: home.id,
        away_team_id: away.id,
        home_name: home.name,
        away_name: away.name,
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : new Date(),
        venue: body.venue || '',
        status: 'scheduled',
        sets: [],
        created_at: new Date(),
      }
      await database.collection('matches').insertOne(match)
      await addLog(database, user, 'match_create', 'match', match.id, {})
      return json({ match: clean(match) })
    }

    // Admin: register result
    if (seg[0] === 'admin' && seg[1] === 'matches' && seg[2] && seg[3] === 'result' && method === 'PUT') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const matchId = seg[2]
      const body = await request.json()
      const sets = (body.sets || []).filter(
        (s) => s.home !== '' && s.away !== '' && s.home != null && s.away != null
      )
      await database.collection('matches').updateOne(
        { id: matchId },
        { $set: { sets, status: 'finished' } }
      )
      await addLog(database, user, 'match_result', 'match', matchId, { sets })
      const updated = await database.collection('matches').findOne({ id: matchId })
      return json({ match: clean(updated) })
    }

    // Admin: attendance registration (manual)
    if (route === '/admin/attendance' && method === 'POST') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const body = await request.json()
      const { team_id, date, records } = body
      const team = await database.collection('teams').findOne({ id: team_id })
      if (!team) return json({ error: 'Equipe inválida' }, 400)
      const day = date || new Date().toISOString().slice(0, 10)
      for (const rec of records || []) {
        await database.collection('attendance').updateOne(
          { athlete_id: rec.athlete_id, date: day },
          {
            $set: {
              athlete_id: rec.athlete_id,
              team_id,
              category: team.category,
              date: day,
              present: !!rec.present,
              created_at: new Date(),
            },
            $setOnInsert: { id: uuidv4() },
          },
          { upsert: true }
        )
      }
      await addLog(database, user, 'attendance_register', 'team', team_id, { date: day })
      return json({ ok: true })
    }

    // Admin: attendance for a team
    if (route === '/admin/attendance' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const teamId = url.searchParams.get('team_id')
      if (!teamId) return json({ error: 'team_id obrigatório' }, 400)
      const attendance = await computeTeamAttendance(database, teamId)
      return json({ attendance })
    }

    // Admin: mocked sumula upload
    if (route === '/admin/sumula' && method === 'POST') {
      const { error, user } = await requireAdmin()
      if (error) return error
      const body = await request.json()
      const record = {
        id: uuidv4(),
        team_id: body.team_id || '',
        category: body.category || '',
        date: body.date || new Date().toISOString().slice(0, 10),
        filename: body.filename || 'sumula.jpg',
        note: 'MOCKED - importação registrada sem OCR real',
        created_at: new Date(),
      }
      await database.collection('sumulas').insertOne(record)
      await addLog(database, user, 'sumula_upload', 'team', record.team_id, {})
      return json({ ok: true, sumula: clean(record), mocked: true })
    }

    // Admin: overview stats
    if (route === '/admin/stats' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const teams = await database.collection('teams').countDocuments({ status: 'approved' })
      const athletes = await database.collection('athletes').countDocuments({ status: 'approved' })
      const matches = await database.collection('matches').countDocuments({})
      const pending_teams = await database.collection('teams').countDocuments({ status: 'pending' })
      const pending_athletes = await database
        .collection('athletes')
        .countDocuments({ status: 'pending' })
      return json({ teams, athletes, matches, pending_teams, pending_athletes })
    }

    // Admin: email log (proof of MOCKED notifications)
    if (route === '/admin/emails' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const emails = await database
        .collection('email_log')
        .find({})
        .sort({ created_at: -1 })
        .limit(50)
        .toArray()
      return json({ emails: emails.map(clean) })
    }

    // Admin: logs
    if (route === '/admin/logs' && method === 'GET') {
      const { error } = await requireAdmin()
      if (error) return error
      const logs = await database
        .collection('logs')
        .find({})
        .sort({ created_at: -1 })
        .limit(80)
        .toArray()
      return json({ logs: logs.map(clean) })
    }

    return json({ error: `Rota ${route} não encontrada` }, 404)
  } catch (error) {
    console.error('API Error:', error)
    return json({ error: 'Erro interno do servidor', detail: String(error?.message || error) }, 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
