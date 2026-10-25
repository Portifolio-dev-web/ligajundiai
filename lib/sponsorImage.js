// Cada patrocinador tem 3 imagens pré-tratadas (recorte + preenchimento com a cor de fundo da
// própria marca), uma por formato de card: flip (3:1), vticker (6:1) e coverflow (1:1) — geradas
// uma vez fora do navegador, em public/images/sponsors/<variante>/<arquivo>. O banco guarda só a
// variante "flip" em sponsors.logo_url; as outras duas têm o mesmo nome de arquivo, só a pasta muda.
export function sponsorImageVariant(logoUrl, variant) {
  if (!logoUrl) return logoUrl
  return logoUrl.replace('/sponsors/flip/', `/sponsors/${variant}/`)
}
