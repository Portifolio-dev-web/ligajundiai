'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'
import { api } from '@/lib/lvjApi'
import { RED } from '@/lib/theme'

export default function AdminEmails() {
  const [emails, setEmails] = useState([])
  useEffect(() => {
    api('/admin/emails').then((d) => setEmails(d.emails || [])).catch(() => {})
  }, [])
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" style={{ color: RED }} /> E-mails transacionais (MOCKED)</CardTitle>
        <CardDescription>Registro dos e-mails que seriam enviados via Resend. Plugue a chave para envio real.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {emails.map((e) => (
          <div key={e.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{e.subject}</span>
              <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
            </div>
            <div className="text-xs text-slate-500">Para: {e.to} • {new Date(e.created_at).toLocaleString('pt-BR')}</div>
            <div className="text-xs text-slate-600 mt-1" dangerouslySetInnerHTML={{ __html: e.html }} />
          </div>
        ))}
        {emails.length === 0 && <p className="text-sm text-slate-600">Nenhum e-mail enviado ainda.</p>}
      </CardContent>
    </Card>
  )
}
