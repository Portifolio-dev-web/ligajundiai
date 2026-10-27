import { redirect } from 'next/navigation'

// PERFORMANCE/UX (redesign do painel do gestor, aprovado por mockup): esta rota era "Jogos" no
// menu do gestor (removido — redundante com Agenda/Frequência do painel) e, na teoria, também
// acessível por atleta (middleware.js permitia os dois papéis), mas nenhum link do produto a
// atleta aqui — quem usa o painel do atleta sempre chega por /atleta → /atleta/jogos. Mantém o
// redirect (em vez de 404) para quem tiver o link antigo salvo; o middleware.js já lida
// corretamente com um gestor caindo aqui (role mismatch em /atleta/jogos o manda de volta para
// /gestor).
export default function JogosRedirectPage() {
  redirect('/atleta/jogos')
}
