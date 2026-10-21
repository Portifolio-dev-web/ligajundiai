// Risco 3 (análise LVJ 2027): texto adaptado dos 3 termos em papel da Liga ("Termos e declarações
// 2026") para exibição digital — mantém o conteúdo jurídico, só remove os campos de preenchimento
// manual (RG, endereço...) que já são coletados em campos de formulário separados.

export function financialResponsibilityTerm({ teamName, category }) {
  const team = teamName?.trim() || '(nome da equipe)'
  const cat = category || '(categoria)'
  return `Declaro que li o regulamento da Liga de Voleibol Jundiaí e aceito o que nele está descrito, responsabilizando-me pela equipe ${team}, inscrita na categoria ${cat}. Assumo a responsabilidade pela observância das normas por minha equipe e pelo cumprimento do artigo 7º do regulamento, referente às taxas e penalidades, autorizando a organização da LVJ a me fornecer os documentos relacionados a eventuais cobranças de multas ou penalidades da equipe. Este termo é válido apenas durante a temporada da Liga de Voleibol Jundiaí.`
}

export const IMAGE_USE_TERM = 'Autorizo, por tempo indeterminado, o uso da minha imagem em qualquer material de comunicação da Liga de Voleibol Jundiaí, podendo ser divulgada em qualquer de seus meios, incluindo redes sociais (YouTube, Facebook, Instagram, X), em todo o território nacional, a título gratuito, sem que nada haja a ser reclamado a título de direitos conexos à minha imagem ou qualquer outro. O tratamento dos dados segue a Lei nº 13.709/2018 (LGPD).'

export const MINOR_GUARDIAN_TERM = 'Como responsável, autorizo a participação do(a) menor na Liga de Voleibol Jundiaí, assumindo a total responsabilidade por sua participação e isentando organizadores e equipe de qualquer ônus antes, durante e depois dos jogos. Declaro que o(a) menor disputará o evento de livre e espontânea vontade, que goza de boa saúde e está em condição física para a competição esportiva, isentando a equipe, os organizadores e os patrocinadores de responsabilidades relacionadas à sua participação, e que concordo com o regulamento e as condições do campeonato.'
