import { redirect } from 'next/navigation'

// PERFORMANCE/UX (redesign do painel do gestor, aprovado por mockup): esta rota ficava atrás do
// link "Agenda" no menu — tudo que ela fazia (aceitar data proposta + histórico filtrado por
// status) já existe na aba "Agenda" dentro do Painel do Gestor, agora com o mesmo ajuste de
// esconder "Aceitar data" depois do aceite desta equipe (ver components/gestor/tabs/
// GestorAgenda.jsx). Mantém o redirect (em vez de 404) para quem tiver o link antigo salvo.
export default function GestorJogosRedirectPage() {
  redirect('/')
}
