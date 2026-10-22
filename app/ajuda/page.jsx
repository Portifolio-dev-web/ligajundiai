// UX (varredura, item O1): não existia "primeiros passos" nem página de ajuda — uma conta nova caía
// direto no painel sem guia nenhum, e não havia onde consultar dúvidas comuns fora da Política de
// Privacidade. O conteúdo abaixo descreve o que o sistema realmente faz hoje (ver
// backend/src/routes/*): nenhum passo ou limite citado aqui foi inventado — em especial, HOJE NÃO
// EXISTE recuperação automática de senha (ver pergunta correspondente), então esta página não finge
// que existe.
//
// ACESSIBILIDADE (varredura, item A4): ver o comentário em app/layout.js.
export const metadata = { title: 'Ajuda' }

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

export default function AjudaPage() {
  return (
    // ACESSIBILIDADE (varredura, item A1): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js.
    <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Página inicial</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Central de Ajuda</CardTitle>
          <CardDescription>Primeiros passos por perfil e respostas para as dúvidas mais comuns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Section title="Primeiros passos — Atleta">
            <p>
              O cadastro é feito em <Link className="underline" href="/cadastro-atleta">/cadastro-atleta</Link>, com
              e-mail, senha e os dados pedidos no formulário (inclui foto para controle de acesso e,
              se for menor de idade, dados do responsável legal). Depois de enviado, o cadastro espera
              a aprovação do gestor da equipe e, em seguida, a aprovação do administrador da liga —
              nessa ordem, sempre as duas. Enquanto isso, o status aparece como pendente; não é preciso
              reenviar nada nem entrar em contato, a menos que o cadastro seja recusado.
            </p>
          </Section>

          <Section title="Primeiros passos — Gestor de equipe">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Na página inicial, abra "Entrar" e use a aba "Cadastrar gestor" para criar a conta.</li>
              <li>Faça login e, no painel do gestor, inscreva a equipe.</li>
              <li>A equipe fica pendente até o administrador aprová-la — só depois disso ela aparece para novos atletas escolherem no cadastro público.</li>
              <li>Com a equipe aprovada, cadastre os atletas (ou aprove os que se cadastraram sozinhos) em "Aprovar atletas".</li>
            </ol>
          </Section>

          <Section title="Primeiros passos — Administrador">
            <p>
              O painel de administração não tem cadastro público — a conta é criada na implantação do
              sistema. Pelo painel, as tarefas mais comuns são: aprovar equipes e atletas em
              "Aprovações", abrir/fechar os períodos de inscrição em "Inscrições", lançar datas de jogos
              em "Agenda" e, em "Segurança da conta", trocar o próprio segredo de autenticação em duas
              etapas (2FA) — obrigatório para todo login de administrador.
            </p>
          </Section>

          <Section title="Esqueci minha senha — e agora?">
            <p>
              Hoje o sistema não tem recuperação automática de senha (nenhum "esqueci minha senha" por
              e-mail). Se você ficou sem acesso à conta, fale com a organização da liga pelo contato
              abaixo para que o problema seja resolvido manualmente.
            </p>
          </Section>

          <Section title="Por que meu cadastro/equipe continua 'pendente'?">
            <p>
              Equipe: aprovação é feita só pelo administrador. Atleta: primeiro o gestor da equipe
              aprova, depois o administrador — as duas etapas são necessárias, nessa ordem. Não há um
              prazo fixo publicado; se demorar mais do que o esperado para a temporada em andamento,
              fale com a organização.
            </p>
          </Section>

          <Section title="O que é o código de 6 dígitos pedido no login do administrador?">
            <p>
              É a autenticação em dois fatores (2FA), obrigatória só para contas de administrador,
              gerada por um aplicativo autenticador (ex.: Google Authenticator, Authy). Quem precisar
              trocar o próprio segredo de 2FA encontra a opção em "Segurança da conta", dentro do
              painel de administração.
            </p>
          </Section>

          <Section title="Como encerro a sessão num computador compartilhado?">
            <p>
              Toda tela interna (painel do gestor e do administrador) tem um botão "Sair" visível no
              topo — ele encerra a sessão de verdade no servidor, não só esconde a tela.
            </p>
          </Section>

          <Section title="Dados pessoais, privacidade e meus direitos como titular">
            <p>
              Veja a <Link className="underline" href="/privacidade">Política de Privacidade</Link> —
              ela descreve quais dados o sistema trata, por quanto tempo, e como pedir acesso,
              correção ou exclusão dos seus dados.
            </p>
          </Section>

          <Section title="Ainda com dúvida?">
            <p>Fale com a organização da Liga de Voleibol Jundiaí: <strong>contato@lvj.com.br</strong></p>
          </Section>
        </CardContent>
      </Card>
    </main>
  )
}
