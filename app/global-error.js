'use client'

// UX (varredura, item I2): global-error.js só entra em ação quando o PRÓPRIO app/layout.js
// quebra (error.js não cobre esse caso, por exigência do Next — ver docs do App Router). Por
// isso este arquivo precisa declarar <html>/<body> do zero e não pode depender de nada que
// também possa falhar (sem Tailwind/Card, só estilo inline). Deve ser raríssimo acontecer na
// prática, mas sem este arquivo o usuário veria a tela de erro em branco padrão do navegador.
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#f8fafc', color: '#1E1B4B' }}>
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Algo deu errado</h1>
          <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
            Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{ background: '#2458A6', color: '#fff', border: 0, borderRadius: '0.375rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              Tentar novamente
            </button>
            <Link
              href="/"
              style={{ border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.5rem 1rem', color: '#1E1B4B', textDecoration: 'none' }}
            >
              Página inicial
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
