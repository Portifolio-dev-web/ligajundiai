import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TermosDeUsoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <CardTitle>Termos de Uso</CardTitle>
          <CardDescription>Regras de acesso e uso do sistema de gestão esportiva da LVJ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-700">
          <p>Use o sistema somente para atividades relacionadas à Liga de Voleibol Jundiaí e mantenha seus dados cadastrais atualizados.</p>
          <p>As credenciais são pessoais e não devem ser compartilhadas. Cada perfil acessa apenas as funções e informações autorizadas para sua função.</p>
          <p>Gestores são responsáveis por enviar informações corretas sobre suas equipes e obter as autorizações necessárias para cadastrar atletas e compartilhar dados pessoais.</p>
          <p>A aprovação de equipes e atletas segue as etapas de análise da Liga. O envio de um cadastro não garante aprovação ou inscrição em uma partida.</p>
          <p>Este texto é um modelo para desenvolvimento e precisa de revisão jurídica e aprovação da organização antes de entrar em vigor.</p>
        </CardContent>
      </Card>
    </main>
  )
}
