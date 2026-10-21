// LGPD (varredura, item L1): esta página estava vazia (0 bytes) e nenhuma tela do site linkava para
// ela — ou seja, os "Termos de Uso" citados implicitamente no cadastro não existiam de fato. O texto
// abaixo descreve o serviço real oferecido pelo sistema (cadastro de equipes/atletas, aprovação,
// agenda, classificação e controle de acesso biométrico aos jogos — ver backend/src/routes/*).
//
// A versão deve acompanhar a mesma POLICY_VERSION da Política de Privacidade (app/privacidade/page.jsx);
// as duas páginas são aceitas juntas no mesmo passo de consentimento do cadastro.
const TERMS_VERSION = '2026-01'

// LGPD (varredura, item L7): sem cache de página estática, para que DPO_NAME/DPO_ROLE/DPO_EMAIL
// (lib/legalTerms.js) sejam lidos do ambiente a cada requisição, não congelados no build da imagem.
export const dynamic = 'force-dynamic'

// ACESSIBILIDADE (varredura, item A4): ver o comentário em app/layout.js.
export const metadata = { title: 'Termos de Uso' }

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { dpoContact } from '@/lib/legalTerms'

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

export default function TermosDeUsoPage() {
  const dpo = dpoContact()
  return (
    // ACESSIBILIDADE (varredura, item A1): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js.
    <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Página inicial</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Termos de Uso</CardTitle>
          <CardDescription>Versão {TERMS_VERSION} · Liga de Voleibol Jundiaí (LVJ)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Section title="1. Aceite">
            <p>
              Ao criar uma conta de gestor de equipe ou de atleta neste sistema, você concorda com estes
              Termos de Uso e com a <Link className="underline" href="/privacidade">Política de Privacidade</Link>.
              Se você não concorda, não finalize o cadastro.
            </p>
          </Section>

          <Section title="2. O que este sistema faz">
            <p>
              A plataforma é o canal oficial de inscrição e gestão da Liga de Voleibol Jundiaí (LVJ):
              cadastro de equipes e atletas, aprovação pelos gestores e pela administração da liga,
              agenda de jogos, classificação, controle de frequência e liberação de acesso às partidas
              por reconhecimento biométrico na catraca do local.
            </p>
          </Section>

          <Section title="3. Quem pode se cadastrar">
            <ul className="list-disc space-y-1 pl-5">
              <li>Gestores de equipe, responsáveis por inscrever a equipe e seus atletas.</li>
              <li>Atletas vinculados a uma equipe já aprovada pela administração da liga.</li>
              <li>Atletas menores de idade (categorias Sub-19), com a participação do responsável legal — veja a seção 9 da Política de Privacidade.</li>
            </ul>
          </Section>

          <Section title="4. Sua responsabilidade pelos dados informados">
            <p>
              Você é responsável por informar dados verdadeiros (nome, RG, data de nascimento) e por
              enviar uma foto sua (ou do atleta sob sua responsabilidade) para o cadastro biométrico.
              Cadastro com dados falsos pode ser recusado ou cancelado pela administração da liga.
            </p>
          </Section>

          <Section title="5. Aprovação de equipes e atletas">
            <p>
              A aprovação de equipes e atletas é feita pelo gestor e, em seguida, pela administração da
              liga, dentro dos períodos de inscrição definidos para cada categoria e temporada. A liga
              pode recusar um cadastro e deve informar o motivo da recusa.
            </p>
          </Section>

          <Section title="6. Regras esportivas">
            <p>
              Pontuação, critérios de desempate e percentual mínimo de frequência seguem o regulamento
              esportivo vigente, definido pela administração da liga e que pode mudar entre temporadas.
            </p>
          </Section>

          <Section title="7. Uso da foto de identificação biométrica">
            <p>
              A foto enviada no cadastro é usada apenas para liberar o acesso do atleta aprovado às
              partidas e para a análise do próprio cadastro pelo gestor e pela administração. Ela não é
              exibida publicamente nas páginas de classificação, súmulas ou agenda.
            </p>
          </Section>

          <Section title="8. Suspensão ou cancelamento de conta">
            <p>
              A liga pode suspender ou cancelar uma conta em caso de dados falsos, uso indevido do
              sistema ou tentativa de burlar o controle de acesso às partidas.
            </p>
          </Section>

          <Section title="9. Isenções">
            <p>
              Fazemos o possível para manter o sistema disponível, mas não garantimos funcionamento
              ininterrupto. O resultado oficial de uma partida é o registrado na súmula correspondente.
            </p>
          </Section>

          <Section title="10. Lei aplicável">
            <p>Estes termos são regidos pelas leis brasileiras, com foro eleito na comarca de Jundiaí, SP.</p>
          </Section>

          <Section title="11. Alterações nestes termos">
            <p>
              Toda mudança relevante gera uma nova versão, identificada no topo desta página — a mesma
              numeração usada na Política de Privacidade.
            </p>
          </Section>

          <Section title="12. Contato">
            <p>
              Dúvidas sobre estes termos: <strong>{dpo.email}</strong>
              {dpo.configured && <> ({dpo.name}, {dpo.role})</>}.
            </p>
          </Section>
        </CardContent>
      </Card>
    </main>
  )
}
