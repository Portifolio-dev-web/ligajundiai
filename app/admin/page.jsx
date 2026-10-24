import AdminDashboard from '@/components/admin/AdminDashboard'

// ACESSIBILIDADE (varredura, item A4): ver o comentário em app/layout.js.
export const metadata = { title: 'Painel administrativo' }

export default function AdminHomePage() {
  return <AdminDashboard />
}
