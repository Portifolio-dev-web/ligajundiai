import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// UX (varredura, item O1): não havia onde consultar dúvidas comuns dentro do painel — a Central de
// Ajuda (app/ajuda/page.jsx) só é útil se for fácil de achar. Componente só, reaproveitado ao lado do
// LogoutButton nas mesmas telas (ver components/LogoutButton.jsx), para não duplicar o link em cada uma.
export default function HelpLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/ajuda"><HelpCircle className="h-4 w-4" /> Ajuda</Link>
    </Button>
  )
}
