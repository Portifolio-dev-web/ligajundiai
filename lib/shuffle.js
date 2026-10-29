// Fisher-Yates — usado pelos 3 componentes de patrocinador (SponsorFlipCards,
// SponsorVerticalTicker, SponsorCoverFlow) pra sortear a própria ordem uma vez por carregamento,
// cada um independente dos outros (ver useMemo em cada componente, que só recalcula quando a
// lista de patrocinadores muda de referência — ou seja, uma vez, quando o fetch inicial resolve).
export function shuffled(list) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
