import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, join, dirname } from 'node:path'
import { pool, query, transaction } from './pool.js'
import { putSponsorLogoVariant } from '../services/storage.js'

const seedAssetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'seed-assets', 'sponsor-logos')
const VARIANTS = ['flip', 'vticker', 'coverflow']

// Os 10 patrocinadores reais da LVJ, cadastrados manualmente uma vez — o nome aqui precisa bater
// exatamente com sponsors.name pra essa semente saber qual arquivo pertence a qual linha. Um
// patrocinador novo que o admin cadastrar depois não entra nesta lista — continua dependendo do
// upload normal pela tela (/admin → Configuração → Patrocínio), que já processa e salva sozinho.
const KNOWN_SPONSOR_SLUGS = {
  'Cereser': 'cereser',
  'Cintia Eduarda - Fisioterapia Esportiva': 'cintia-eduarda',
  'Drogaria Marlene': 'drogaria-marlene',
  'Fuzzy Açaí': 'fuzzy-acai',
  'Studio Kim - Joaquim Oliveira': 'studio-kim',
  'Jundiá Sorvetes': 'jundia-sorvetes',
  'Magofy': 'magofy',
  'MDQ Esportes': 'mdq-esportes',
  'Mais Esporte - TV Mais Brasil': 'mais-esporte',
  'WS Pets Jundiaí': 'ws-pets-jundiai',
}

// SEGURANÇA: mesmo padrão de trava do seedAdmin() (pg_advisory_xact_lock) — evita duas réplicas da
// API, subindo ao mesmo tempo contra um banco recém-criado, tentarem reenviar os mesmos logos em
// paralelo. Número de trava diferente dos já usados (740218 migrate.js, 740219 seed-admin.js).
const SEED_LOCK_ID = 740220

// Restaura automaticamente os logos dos 10 patrocinadores reais quando faltam (ex.: depois de um
// `docker compose down --volumes`, que apaga o S3_PUBLIC_BUCKET junto com o resto dos dados locais
// — a semente de sponsors em schema.sql recria os NOMES, mas não tem como recriar arquivo nenhum a
// partir de SQL puro). As imagens já tratadas (recorte + preenchimento com a cor da marca) ficam
// versionadas no git, em backend/seed-assets/ — por isso sobrevivem a qualquer reset de volume.
export async function seedSponsorLogos() {
  const missing = await query(
    `SELECT id, name FROM sponsors WHERE deleted_at IS NULL AND logo_url = ''`,
  )
  let restored = 0
  for (const sponsor of missing.rows) {
    const slug = KNOWN_SPONSOR_SLUGS[sponsor.name]
    if (!slug) continue

    const buffers = {}
    try {
      for (const variant of VARIANTS) {
        buffers[variant] = await readFile(join(seedAssetsDir, variant, `${slug}.jpg`))
      }
    } catch {
      // Nome bate com um dos 10 conhecidos, mas o arquivo de semente não existe (build sem os
      // assets, por exemplo) — não impede o boot, só deixa esse patrocinador sem logo mesmo,
      // igual qualquer outro cadastrado pela tela sem upload ainda.
      continue
    }

    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_ID])
      const current = await client.query('SELECT logo_url FROM sponsors WHERE id = $1 FOR UPDATE', [sponsor.id])
      if (current.rows[0]?.logo_url) return // outra instância já restaurou entre o SELECT e aqui
      for (const variant of VARIANTS) {
        await putSponsorLogoVariant(sponsor.id, variant, buffers[variant])
      }
      await client.query(
        'UPDATE sponsors SET logo_url = $2, updated_at = now() WHERE id = $1',
        [sponsor.id, `/api/sponsor-logos/flip/${sponsor.id}`],
      )
    })
    restored++
  }
  if (restored > 0) console.info(`Sponsor logo seed restored ${restored} logo(s)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await seedSponsorLogos()
  } catch (error) {
    console.error('Sponsor logo seed failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
