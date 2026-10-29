import sharp from 'sharp'

// Os 10 primeiros logos reais da liga vieram como exportações de rede social — muito espaço vazio
// ao redor da marca (ex.: um logo usava só 11% da altura do arquivo). Tratados manualmente uma vez
// (recorte + preenchimento com a cor de fundo da própria marca) pra cada um dos 3 cards do site;
// esta função reproduz o mesmo tratamento, agora rodando no servidor a cada upload do admin.
const TARGETS = {
  flip: { w: 420, h: 140 }, // Patrocinadores oficiais (flip 3D) — proporção 3:1
  vticker: { w: 720, h: 120 }, // Espaço Patrocinador (faixa vertical) — proporção 6:1
  coverflow: { w: 96, h: 96 }, // Patrocínio no rodapé (cover flow) — quadrado 1:1
}

// O recorte automático do sharp (trim) compara cada pixel de borda com um pixel de referência do
// canto — um artefato de JPEG de 1px bem no (0,0), às vezes mais claro/escuro que o resto do
// fundo, engana essa amostra. 2% de distância do canto evita isso (mesmo ajuste feito manualmente
// ao tratar os 10 logos atuais).
async function backgroundColor(buffer) {
  const meta = await sharp(buffer).metadata()
  const insetX = Math.max(4, Math.round(meta.width * 0.02))
  const insetY = Math.max(4, Math.round(meta.height * 0.02))
  const pixel = await sharp(buffer)
    .extract({ left: insetX, top: insetY, width: 1, height: 1 })
    .raw()
    .toBuffer()
  return { r: pixel[0], g: pixel[1], b: pixel[2] }
}

// Gera os 3 formatos a partir de uma imagem bruta enviada pelo admin. Lança se o buffer não for
// uma imagem válida (sharp recusa) — o chamador decide a mensagem de erro para o usuário.
export async function buildSponsorLogoVariants(rawBuffer) {
  const trimmed = await sharp(rawBuffer).trim({ threshold: 12 }).toBuffer()
  const background = await backgroundColor(trimmed)

  const variants = {}
  for (const [name, target] of Object.entries(TARGETS)) {
    variants[name] = await sharp(trimmed)
      .resize({ width: target.w, height: target.h, fit: 'contain', background })
      .flatten({ background })
      .jpeg({ quality: 90 })
      .toBuffer()
  }
  return variants
}
