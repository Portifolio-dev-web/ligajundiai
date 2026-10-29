import { redirect } from 'next/navigation'

// UX (auditoria de leis de UX, Lei de Occam/Lei de Jakob, Fase 2): esta rota era a 3ª
// implementação diferente de "aprovar atleta" — a mesma ação tinha 3 telas com visual distinto
// (esta tabela standalone, a aba "Aprovar atletas" e a aprovação inline da aba "Elenco"). Tudo que
// ela fazia já existe na aba "Aprovar atletas" do Painel do Gestor (ver
// components/gestor/tabs/GestorApproveAthletes.jsx). Mantém o redirect (em vez de 404) para quem
// tiver o link antigo salvo — mesmo padrão já usado em /gestor/jogos.
export default function GestorAprovarAtletasRedirectPage() {
  redirect('/')
}
