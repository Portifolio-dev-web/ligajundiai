// Cada patrocinador tem 3 imagens pré-tratadas (recorte + preenchimento com a cor de fundo da
// própria marca), uma por formato de card: flip (3:1), vticker (6:1) e coverflow (1:1) — geradas
// no servidor a partir do upload do admin (ver backend/src/services/sponsorImage.js) e servidas em
// /api/sponsor-logos/<variante>/<id>. O banco guarda só a variante "flip" em sponsors.logo_url; as
// outras duas têm a mesma origem, só a variante na URL muda.
export function sponsorImageVariant(logoUrl, variant) {
  if (!logoUrl) return logoUrl
  return logoUrl.replace('/sponsor-logos/flip/', `/sponsor-logos/${variant}/`)
}
