import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { config } from '../config.js'
import { pool, transaction } from './pool.js'
import { runMigrations } from './migrate.js'
import { seedAdmin } from './seed-admin.js'
import { encryptSensitive, cpfDigest } from '../security/crypto.js'
import { unusablePasswordHash } from '../security/auth.js'
import { cleanText } from '../security/validation.js'

function dateOr(value, fallback = null) {
  if (!value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function safeUuid(value) {
  const candidate = String(value ?? '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : randomUUID()
}

function normalizePosition(value) {
  const aliases = {
    central: 'central',
    ponteiro: 'ponteiro',
    saida: 'saida',
    levantador: 'levantador',
    libero: 'libero',
  }
  const normalized = String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  return aliases[normalized] ? [aliases[normalized]] : []
}

async function findRows(database, name) {
  if (!(await database.listCollections({ name }).hasNext())) return []
  return database.collection(name).find({}).toArray()
}

export async function migrateLegacyData({ mongoUrl, mongoDatabase }) {
  if (!mongoUrl || !mongoDatabase) throw new Error('Set LEGACY_MONGO_URL and LEGACY_MONGO_DATABASE before importing data')
  await runMigrations()
  await seedAdmin()
  const mongo = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 })
  try {
    await mongo.connect()
    const oldDb = mongo.db(mongoDatabase)
    const [users, teams, athletes, matches, attendance, rules, sponsors, notifications, logs, sumulas] = await Promise.all([
      findRows(oldDb, 'users'),
      findRows(oldDb, 'teams'),
      findRows(oldDb, 'athletes'),
      findRows(oldDb, 'matches'),
      findRows(oldDb, 'attendance'),
      findRows(oldDb, 'rules'),
      findRows(oldDb, 'sponsors'),
      findRows(oldDb, 'notifications'),
      findRows(oldDb, 'logs'),
      findRows(oldDb, 'sumulas'),
    ])

    const makeIdMap = (records) => new Map(records.map((record) => {
      const oldId = String(record.id ?? record._id)
      return [oldId, safeUuid(oldId)]
    }))
    const userIds = makeIdMap(users)
    const teamIds = makeIdMap(teams)
    const athleteIds = makeIdMap(athletes)
    const matchIds = makeIdMap(matches)
    const mappedId = (map, oldId, kind) => {
      const id = map.get(String(oldId))
      if (!id) throw new Error(`Legacy record refers to unknown ${kind} ${oldId}`)
      return id
    }
    const idMap = new Map()
    const adminEmail = config.ADMIN_EMAIL.toLowerCase()
    const counts = await transaction(async (client) => {
      const imported = await client.query('SELECT source FROM legacy_imports WHERE source = $1', [mongoDatabase])
      if (imported.rowCount) return { skipped: true }

      for (const oldUser of users) {
        const legacyId = String(oldUser.id ?? oldUser._id)
        const oldId = userIds.get(legacyId)
        const email = String(oldUser.email ?? '').trim().toLowerCase()
        if (!email) throw new Error(`Legacy user ${oldId} has no e-mail; correct the source data before importing`)
        const existing = await client.query('SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL', [email])
        const id = existing.rows[0]?.id ?? oldId
        idMap.set(legacyId, id)
        const role = oldUser.role === 'admin' ? 'admin' : oldUser.role === 'atleta' ? 'atleta' : 'gestor'
        if (role === 'admin' && email !== adminEmail) {
          throw new Error(`Legacy admin ${email} is not ADMIN_EMAIL; configure the intended administrator before importing`)
        }
        const cpf = oldUser.cpf ? String(oldUser.cpf).replace(/\D/g, '') : null
        const legacyHash = oldUser.password_hash && oldUser.password_salt ? String(oldUser.password_hash) : null
        const legacySalt = legacyHash ? String(oldUser.password_salt) : null
        const createdAt = dateOr(oldUser.created_at, new Date())

        if (email === adminEmail && existing.rowCount) {
          continue
        }
        await client.query(
          `INSERT INTO users
           (id, role, status, name, email, password_hash, legacy_password_salt, legacy_password_hash,
            phone, cpf_ciphertext, cpf_hash, consent_at, consent_version, consent_confirmed,
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL,
             'legacy-import-no-recorded-consent', false, $12, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            id, role, oldUser.status === 'suspended' ? 'suspended' : 'active',
            cleanText(oldUser.name || 'Usuário importado', 120), email,
            legacyHash ? '!legacy-scrypt!' : unusablePasswordHash(),
            legacySalt, legacyHash,
            cleanText(oldUser.phone || '', 30) || null,
            cpf ? encryptSensitive(cpf) : null, cpf ? cpfDigest(cpf) : null, createdAt,
          ],
        )
      }

      const mappedUserId = (legacyId) => {
        return mappedId(idMap, legacyId, 'user')
      }

      for (const oldTeam of teams) {
        const id = mappedId(teamIds, oldTeam.id ?? oldTeam._id, 'team')
        await client.query(
          `INSERT INTO teams (id, name, category, manager_user_id, status, justification, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7) ON CONFLICT (id) DO NOTHING`,
          [
            id, cleanText(oldTeam.name || 'Equipe importada', 100),
            cleanText(oldTeam.category || 'Categoria não informada', 80),
            mappedUserId(oldTeam.manager_user_id),
            ['approved', 'rejected'].includes(oldTeam.status) ? oldTeam.status : 'pending',
            cleanText(oldTeam.justification || '', 500) || null,
            dateOr(oldTeam.created_at, new Date()),
          ],
        )
      }

      const teamById = new Map(teams.map((team) => [String(team.id ?? team._id), team]))
      for (const oldAthlete of athletes) {
        const oldTeamId = String(oldAthlete.team_id)
        const oldTeam = teamById.get(oldTeamId)
        if (!oldTeam) throw new Error(`Legacy athlete ${oldAthlete.id ?? oldAthlete._id} refers to unknown team ${oldTeamId}`)
        const id = mappedId(athleteIds, oldAthlete.id ?? oldAthlete._id, 'athlete')
        const cpf = oldAthlete.cpf ? String(oldAthlete.cpf).replace(/\D/g, '') : null
        const status = oldAthlete.status === 'approved' ? 'approved' :
          oldAthlete.status === 'rejected' ? 'rejected' : 'awaiting_admin'
        const position = normalizePosition(oldAthlete.position)
        const date = dateOr(oldAthlete.birthdate)
        const managerId = oldAthlete.manager_user_id
          ? mappedUserId(oldAthlete.manager_user_id)
          : mappedUserId(oldTeam.manager_user_id)
        const createdAt = dateOr(oldAthlete.created_at, new Date())
        await client.query(
          `INSERT INTO athletes
           (id, team_id, manager_user_id, name, cpf_ciphertext, cpf_hash, birthdate,
            positions, status, justification, consent_at, consent_version, consent_confirmed,
            biometry_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL,
             'legacy-import-no-recorded-consent', false, 'pending', $11, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            id, mappedId(teamIds, oldTeam.id ?? oldTeam._id, 'team'), managerId,
            cleanText(oldAthlete.name || 'Atleta importado', 120),
            cpf ? encryptSensitive(cpf) : null, cpf ? cpfDigest(cpf) : null,
            date, position, status, cleanText(oldAthlete.justification || '', 500) || null, createdAt,
          ],
        )
        if (position.length) {
          await client.query('INSERT INTO athlete_positions (athlete_id, position) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, position[0]])
        }
      }

      const athleteById = new Map(athletes.map((athlete) => [String(athlete.id ?? athlete._id), athlete]))
      for (const oldMatch of matches) {
        const home = mappedId(teamIds, oldMatch.home_team_id, 'team')
        const away = mappedId(teamIds, oldMatch.away_team_id, 'team')
        const homeTeam = teamById.get(String(oldMatch.home_team_id))
        const awayTeam = teamById.get(String(oldMatch.away_team_id))
        if (!homeTeam || !awayTeam) throw new Error(`Legacy match ${oldMatch.id ?? oldMatch._id} refers to an unknown team`)
        await client.query(
          `INSERT INTO matches (id, category, round, home_team_id, away_team_id, home_name, away_name,
            scheduled_at, venue, status, sets, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            mappedId(matchIds, oldMatch.id ?? oldMatch._id, 'match'), cleanText(oldMatch.category || homeTeam.category, 80),
            cleanText(oldMatch.round || '', 80), home, away,
            cleanText(oldMatch.home_name || homeTeam.name, 100), cleanText(oldMatch.away_name || awayTeam.name, 100),
            dateOr(oldMatch.scheduled_at, new Date()), cleanText(oldMatch.venue || '', 200),
            oldMatch.status === 'finished' ? 'finished' : 'scheduled',
            JSON.stringify(Array.isArray(oldMatch.sets) ? oldMatch.sets : []),
            dateOr(oldMatch.created_at, new Date()),
          ],
        )
      }

      for (const oldAttendance of attendance) {
        const athlete = athleteById.get(String(oldAttendance.athlete_id))
        if (!athlete) throw new Error(`Legacy attendance refers to unknown athlete ${oldAttendance.athlete_id}`)
        const teamId = oldAttendance.team_id
          ? mappedId(teamIds, oldAttendance.team_id, 'team')
          : mappedId(teamIds, athlete.team_id, 'team')
        const day = dateOr(oldAttendance.date, new Date()).toISOString().slice(0, 10)
        await client.query(
          `INSERT INTO attendance (athlete_id, team_id, attendance_date, present, source)
           VALUES ($1, $2, $3, $4, 'manual')
           ON CONFLICT (athlete_id, attendance_date) WHERE match_id IS NULL AND deleted_at IS NULL
           DO UPDATE SET present = EXCLUDED.present`,
          [mappedId(athleteIds, oldAttendance.athlete_id, 'athlete'), teamId, day, Boolean(oldAttendance.present)],
        )
      }

      const oldRules = rules[0]
      if (oldRules) {
        await client.query(
          `UPDATE rules SET points = $1::jsonb, tiebreakers = $2::jsonb,
           min_attendance_percent = $3, updated_at = now() WHERE id = 'league_rules'`,
          [
            JSON.stringify(oldRules.points ?? {}),
            JSON.stringify(oldRules.tiebreakers ?? ['points', 'wins', 'sets_ratio', 'points_ratio']),
            Number(oldRules.min_attendance_percent ?? 70),
          ],
        )
      }
      for (const sponsor of sponsors) {
        await client.query(
          `INSERT INTO sponsors (name, logo_url, website, tier, active)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            cleanText(sponsor.name || 'Patrocinador importado', 120),
            cleanText(sponsor.logo_url || '', 500), cleanText(sponsor.website || '', 500),
            cleanText(sponsor.tier || 'apoio', 40), sponsor.active !== false,
          ],
        )
      }
      for (const notification of notifications) {
        const target = notification.target === 'admin' || notification.target === 'admin@lvj.com'
          ? 'admin' : (idMap.get(String(notification.target)) || 'admin')
        await client.query(
          `INSERT INTO notifications (id, target, type, title, body, read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [
            safeUuid(notification.id ?? notification._id), target,
            cleanText(notification.type || 'legacy', 80), cleanText(notification.title || '', 200),
            cleanText(notification.body || '', 2000), Boolean(notification.read),
            dateOr(notification.created_at, new Date()),
          ],
        )
      }
      for (const log of logs) {
        const actorId = idMap.get(String(log.actor_id)) || null
        await client.query(
          `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) ON CONFLICT (id) DO NOTHING`,
          [
            safeUuid(log.id ?? log._id), actorId, cleanText(log.actor_name || 'legacy', 120),
            cleanText(log.action || 'legacy.import', 100), cleanText(log.entity_type || 'legacy', 80),
            String(log.entity_id || ''), JSON.stringify(log.metadata || {}),
            dateOr(log.created_at, new Date()),
          ],
        )
      }
      for (const sumula of sumulas) {
        await client.query(
          `INSERT INTO sumulas (id, team_id, category, match_date, filename, note, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [
            safeUuid(sumula.id ?? sumula._id),
            teamById.has(String(sumula.team_id)) ? mappedId(teamIds, sumula.team_id, 'team') : null,
            cleanText(sumula.category || 'Categoria importada', 80),
            dateOr(sumula.date, new Date()).toISOString().slice(0, 10),
            cleanText(sumula.filename || 'sumula.jpg', 200), cleanText(sumula.note || 'Importada do MongoDB', 500),
            dateOr(sumula.created_at, new Date()),
          ],
        )
      }

      const documentCounts = { users: users.length, teams: teams.length, athletes: athletes.length, matches: matches.length, attendance: attendance.length, sponsors: sponsors.length, notifications: notifications.length, logs: logs.length, sumulas: sumulas.length }
      await client.query(
        'INSERT INTO legacy_imports (source, document_counts) VALUES ($1, $2::jsonb)',
        [mongoDatabase, JSON.stringify(documentCounts)],
      )
      return documentCounts
    })
    return counts
  } finally {
    await mongo.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  migrateLegacyData({
    mongoUrl: process.env.LEGACY_MONGO_URL,
    mongoDatabase: process.env.LEGACY_MONGO_DATABASE,
  }).then((counts) => console.info('Legacy MongoDB import complete:', counts))
    .catch((error) => {
      console.error('Legacy MongoDB import failed:', error)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
