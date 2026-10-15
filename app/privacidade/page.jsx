import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          <CardTitle>Política de Privacidade</CardTitle>
          <CardDescription>Informações sobre os dados usados na gestão esportiva da LVJ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-700">
          <p>Tratamos dados cadastrais e de contato para administrar equipes, atletas, jogos, aprovações e frequência da liga.</p>
          <p>O CPF é usado para identificação, armazenado criptografado e exibido de forma mascarada. A imagem biométrica é opcional no cadastro, enviada diretamente ao armazenamento autorizado e usada para integração de controle de acesso a jogos.</p>
          <p>O acesso aos dados é limitado conforme o perfil de Administrador, Gestor de Equipe ou Atleta. Os registros de ações administrativas são mantidos para auditoria e segurança.</p>
          <p>Para solicitar acesso, correção, anonimização ou exclusão de dados, use a área de privacidade após autenticar-se ou entre em contato com a administração da Liga.</p>
          <p>O consentimento pode ser revogado; dados necessários para obrigações legais, prevenção a fraude ou exercício de direitos poderão ser retidos pelo período aplicável.</p>
          <p>Esta página é um resumo informativo para o ambiente de desenvolvimento e deve ser revisada pela organização antes de uso em produção.</p>
        </CardContent>
      </Card>
    </main>
  )
}
