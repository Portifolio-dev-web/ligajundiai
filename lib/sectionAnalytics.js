// Fonte única da whitelist de seções rastreáveis — reaproveitada pelo Zod de
// app/api/analytics/section-view/route.js para que o front-end e a validação do servidor nunca
// divirjam sobre quais sectionId são aceitos.
export const ALLOWED_SECTION_IDS = ['quem-somos', 'seja-patrocinador']

// Chamada pelo cleanup de useTimeOnScreen (hooks/use-time-on-screen.js) quando uma seção termina
// de ser medida. console.info sempre registra o evento; o sendBeacon é melhor-esforço (ex.: SSR,
// navegador antigo, ou a própria chamada falhando) — por isso nunca lança para quem a invoca.
export function reportSectionView({ sectionId, timeSpentInSeconds }) {
  if (!ALLOWED_SECTION_IDS.includes(sectionId)) return
  if (!Number.isFinite(timeSpentInSeconds) || timeSpentInSeconds <= 0) return

  const payload = { sectionId, timeSpentInSeconds }
  console.info('[analytics] section_view', payload)

  // sendBeacon, não fetch: a página pode estar sendo descarregada (fechar aba, navegar para fora
  // do site) no exato momento desta chamada — um fetch comum arrisca ser abortado pelo navegador
  // antes de saber se a requisição saiu; sendBeacon é desenhado para sobreviver a esse instante.
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    navigator.sendBeacon('/api/analytics/section-view', blob)
  } catch {
    // Sem fallback: o console.info acima já registrou o evento, e sendBeacon não costuma lançar.
  }
}
