// LGPD (varredura, item L1): esta página estava vazia (0 bytes) — todo cadastro do site linka para
// aqui pedindo "consentimento com o tratamento dos dados conforme a Política de Privacidade", mas não
// havia política nenhuma para ler. O conteúdo abaixo descreve o que o sistema realmente faz hoje
// (ver backend/sql/schema.sql e backend/src/routes/*): nenhuma finalidade ou destinatário citado aqui
// foi inventado. Ao mudar infraestrutura (novo provedor de e-mail, nova nuvem de arquivos etc.), esta
// página também precisa ser atualizada — política desatualizada é falha de transparência (art. 6º, VI).
//
// A versão exibida abaixo deve acompanhar a variável de ambiente CONSENT_VERSION do backend
// (backend/src/config.js). Se o texto mudar de forma relevante, suba a versão nas duas pontas.
const POLICY_VERSION = '2026-01'

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

export default function PrivacidadePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Página inicial</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Política de Privacidade</CardTitle>
          <CardDescription>Versão {POLICY_VERSION} · Liga de Voleibol Jundiaí (LVJ)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Section title="1. Quem somos e qual o nosso papel">
            <p>
              A Liga de Voleibol Jundiaí (LVJ) organiza o campeonato e administra este sistema de
              inscrições, agenda e controle de acesso aos jogos. Para os dados pessoais tratados aqui
              (contas de gestores e atletas, times, frequência e biometria de acesso), a LVJ é a
              <strong> controladora</strong> dos dados, nos termos do art. 5º, VI, da Lei nº 13.709/2018 (LGPD).
            </p>
          </Section>

          <Section title="2. Quais dados tratamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>Dados de conta: nome, e-mail, telefone (gestor) e senha — a senha nunca é guardada em texto puro, só um hash criptográfico dela.</li>
              <li>CPF de gestores e atletas: guardado de forma criptografada no banco de dados, usado apenas para identificar cada pessoa sem duplicidade entre equipes.</li>
              <li>Dados do atleta: data de nascimento, posição em quadra, status do cadastro e uma foto para controle de acesso biométrico às partidas. A foto biométrica é <strong>dado pessoal sensível</strong> (art. 5º, II, e art. 11 da LGPD).</li>
              <li>Frequência: presença registrada em cada jogo, usada para calcular a elegibilidade por percentual mínimo de presença definido no regulamento da liga.</li>
              <li>Segredo de autenticação em dois fatores — somente para contas de administração da liga.</li>
              <li>Um cookie de sessão técnico (ver seção 10).</li>
            </ul>
          </Section>

          <Section title="3. Para que usamos cada dado e com qual base legal">
            <ul className="list-disc space-y-1 pl-5">
              <li>Criar e manter sua conta e sua inscrição na liga: execução de contrato (art. 7º, V).</li>
              <li>Conferir identidade e evitar cadastro duplicado pelo CPF: execução de contrato e legítimo interesse da organização (art. 7º, V e IX).</li>
              <li>Liberar o acesso dos atletas às partidas pela catraca biométrica: consentimento específico e destacado, por ser dado sensível (art. 11, I).</li>
              <li>Calcular classificação, súmulas e elegibilidade por frequência: execução do regulamento esportivo (execução de contrato).</li>
              <li>Enviar e-mails sobre aprovação/recusa de equipe ou atleta e o código de acesso sem senha: execução de contrato.</li>
              <li>Registrar trilha de auditoria e aplicar limites de tentativa de login: cumprimento de dever legal de segurança (arts. 46 a 49) e legítimo interesse.</li>
            </ul>
          </Section>

          <Section title="4. Com quem compartilhamos dados">
            <p>Não vendemos nem usamos seus dados para publicidade. Compartilhamos apenas com quem presta serviço técnico à liga:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Serviço de envio de e-mail, para as notificações da plataforma.</li>
              <li>Armazenamento de arquivos compatível com S3, que guarda a foto biométrica num espaço de acesso restrito; o link para baixá-la expira em poucos minutos e nunca é público.</li>
              <li>Sistema de controle de acesso (catraca) do local dos jogos, que recebe apenas a referência da biometria necessária para liberar a entrada do atleta.</li>
            </ul>
          </Section>

          <Section title="5. Transferência internacional">
            <p>
              Se algum dos serviços acima estiver hospedado fora do Brasil, aplicamos as garantias exigidas
              pela LGPD (art. 33) e atualizamos esta seção com o nome do serviço e o país. Hoje a
              organização ainda precisa confirmar e preencher esse dado aqui.
            </p>
          </Section>

          <Section title="6. Como protegemos seus dados">
            <ul className="list-disc space-y-1 pl-5">
              <li>Senhas com algoritmo resistente a quebra por força bruta (argon2id).</li>
              <li>CPF cifrado no banco de dados (AES-256-GCM), nunca armazenado em texto puro.</li>
              <li>Autenticação em dois fatores obrigatória para contas de administração.</li>
              <li>Sessão de login revogável a qualquer momento (encerrar sessão invalida o acesso imediatamente).</li>
              <li>Limite de tentativas em login e nos códigos de acesso temporários.</li>
              <li>Trilha de auditoria das ações realizadas sobre cadastros e aprovações.</li>
            </ul>
          </Section>

          <Section title="7. Por quanto tempo guardamos os dados">
            <p>
              Enquanto sua conta estiver ativa, e durante o tempo necessário para preservar o histórico
              esportivo da temporada (classificação e súmulas). Se você pedir a exclusão da sua conta,
              anonimizamos imediatamente os dados que identificam você (nome, CPF, foto, contatos),
              mantendo apenas o resultado esportivo já despersonalizado, necessário para a integridade da
              classificação da liga.
            </p>
          </Section>

          <Section title="8. Seus direitos e como exercê-los">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Acesso e exportação</strong>: disponíveis a qualquer momento dentro da sua conta.</li>
              <li><strong>Correção</strong>: solicite à organização da liga pelo contato abaixo.</li>
              <li><strong>Exclusão/anonimização</strong>: disponível a qualquer momento dentro da sua conta.</li>
              <li><strong>Revogação do consentimento</strong> para a foto biométrica: tem o mesmo efeito do pedido de exclusão e impede novo acesso biométrico às partidas.</li>
            </ul>
            <p>Canal de contato para exercer esses direitos: <strong>contato@lvj.com.br</strong>.</p>
          </Section>

          <Section title="9. Crianças e adolescentes">
            <p>
              Categorias como Sub-19 podem incluir atletas menores de 18 anos. O cadastro de um atleta
              menor de idade deve ser feito com a participação e o consentimento do responsável legal
              (art. 14 da LGPD). Hoje pedimos que quem faz o cadastro confirme que obteve esse
              consentimento; a liga está evoluindo o formulário para também registrar a identificação do
              responsável diretamente no sistema.
            </p>
          </Section>

          <Section title="10. Cookies">
            <p>
              Usamos apenas o cookie de sessão <code>lvj_session</code>, técnico e necessário para manter
              você logado — ele não serve para rastreamento, publicidade ou estatística. Não usamos
              cookies de terceiros. Se isso mudar, esta política será atualizada antes da mudança entrar
              em vigor.
            </p>
          </Section>

          <Section title="11. Alterações nesta política">
            <p>
              Toda mudança relevante no texto gera uma nova versão, identificada no topo desta página.
              Fique atento à versão quando revisar seu consentimento.
            </p>
          </Section>

          <Section title="12. Contato">
            <p>Dúvidas sobre privacidade ou sobre esta política: <strong>contato@lvj.com.br</strong>.</p>
          </Section>
        </CardContent>
      </Card>
    </main>
  )
}
