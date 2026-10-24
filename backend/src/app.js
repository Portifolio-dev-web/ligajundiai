import { randomUUID } from 'node:crypto'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { allowedOrigins } from './config.js'
import { AppError } from './errors.js'
import { authRouter } from './routes/auth.js'
import { teamsRouter, adminTeamsRouter } from './routes/teams.js'
import {
  adminAthleteActionsRouter,
  athletesRouter,
  gestorAthletesRouter,
} from './routes/athletes.js'
import {
  adminGamesRouter,
  adminRulesRouter,
  gestorGamesRouter,
  matchesRouter,
  scheduleRouter,
} from './routes/games.js'
import { adminRouter } from './routes/admin.js'
import { adminCategoriesRouter } from './routes/categories.js'
import { attendanceRouter, approvedTeamsRouter, publicRouter } from './routes/public.js'
import { privacyRouter } from './routes/privacy.js'
import { webhooksRouter } from './routes/webhooks.js'
import { apiRateLimit } from './security/rate-limit.js'
import { query } from './db/pool.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida'))
    },
  }))
  app.use((req, res, next) => {
    req.requestId = randomUUID()
    res.setHeader('X-Request-Id', req.requestId)
    next()
  })
  app.use(express.json({
    limit: '32kb',
    verify(req, _res, buffer) {
      req.rawBody = Buffer.from(buffer)
    },
  }))
  app.use(cookieParser())
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin')
      if (origin && !allowedOrigins.includes(origin)) {
        return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida'))
      }
    }
    next()
  })

  app.get('/health', async (_req, res, next) => {
    try {
      await query('SELECT 1')
      res.json({ status: 'ok' })
    } catch (error) {
      next(error)
    }
  })

  // SEGURANÇA (varredura, item S17): sem isso, respostas da API (listas de atletas, exportação,
  // e-mails) podiam ficar em cache de proxy compartilhado ou no disco do navegador — dado pessoal
  // não deveria sobreviver fora da sessão de quem pediu.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', apiRateLimit)
  app.use('/api', publicRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/teams', teamsRouter)
  app.use('/api/admin/teams', adminTeamsRouter)
  app.use('/api/admin/teams-approved', approvedTeamsRouter)
  app.use('/api/athletes', athletesRouter)
  app.use('/api/gestor/athletes', gestorAthletesRouter)
  app.use('/api/admin/athletes', adminAthleteActionsRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/admin/categories', adminCategoriesRouter)
  app.use('/api/admin', adminGamesRouter)
  app.use('/api/gestor/matches', gestorGamesRouter)
  app.use('/api/matches', matchesRouter)
  app.use('/api', scheduleRouter)
  app.use('/api/rules', adminRulesRouter)
  app.use('/api/admin', adminRulesRouter)
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/privacy', privacyRouter)
  app.use('/api/webhooks', webhooksRouter)

  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada')))
  app.use((error, req, res, _next) => {
    if (res.headersSent) return
    if (error.code === '23505') {
      return res.status(409).json({ error: 'O recurso já existe', code: 'CONFLICT', request_id: req.requestId })
    }
    if (error.code === '23503' || error.code === '23514' || error.code === '22P02') {
      return res.status(400).json({ error: 'Dados incompatíveis com as regras do sistema', code: 'INVALID_DATA', request_id: req.requestId })
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Requisição excede o limite permitido', code: 'PAYLOAD_TOO_LARGE', request_id: req.requestId })
    }
    const status = error instanceof AppError ? error.status : 500
    if (status >= 500) console.error(`Request ${req.requestId} failed:`, error)
    return res.status(status).json({
      error: status >= 500 ? 'Erro interno do servidor' : error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {}),
      request_id: req.requestId,
    })
  })
  return app
}

export const app = createApp()
