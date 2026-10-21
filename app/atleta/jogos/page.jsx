import MatchAttendance from '@/components/MatchAttendance'

// ACESSIBILIDADE (varredura, item A4): ver o comentário em app/layout.js.
export const metadata = { title: 'Meus jogos' }

export default function AthleteGamesPage() {
  return <MatchAttendance expectedRole="atleta" />
}