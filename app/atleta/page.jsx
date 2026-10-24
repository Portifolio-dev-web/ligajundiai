import { redirect } from 'next/navigation'

// PERFORMANCE/UX (varredura, item U-Média-1): /atleta é permitida pelo middleware.js (exige papel
// atleta) mas não tinha page.jsx — quem acessasse a URL direto (link antigo, digitação manual)
// caía na 404 padrão em vez de ver algo útil. Mesmo padrão do admin, que cai em /admin a partir de
// "/" (ver middleware.js:168-174).
export default function AthleteHomePage() {
  redirect('/atleta/jogos')
}
