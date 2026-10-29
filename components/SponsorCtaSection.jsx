'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Award, Handshake, Mail, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTimeOnScreen } from '@/hooks/use-time-on-screen'
import { BLUE, NAVY, RED } from '@/lib/theme'

const SECTION_ID = 'seja-patrocinador'
const SPONSOR_EMAIL = 'contato@lvj.com.br'
const SPONSOR_EMAIL_SUBJECT = 'Quero ser patrocinador da LVJ'

const SPONSOR_TIERS = [
  {
    id: 'ouro',
    name: 'Ouro',
    icon: Trophy,
    highlight: true,
    benefits: [
      'Logo em destaque nos uniformes oficiais',
      'Naming rights em partidas e banners da arena',
      'Menção em todas as publicações da liga',
    ],
  },
  {
    id: 'prata',
    name: 'Prata',
    icon: Award,
    highlight: false,
    benefits: [
      'Logo nos banners oficiais da arena',
      'Menção nas publicações de temporada',
      'Espaço de destaque no site da liga',
    ],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    icon: Handshake,
    highlight: false,
    benefits: [
      'Logo no rodapé do site da liga',
      'Presença no mosaico de patrocinadores',
      'Certificado oficial de apoiador',
    ],
  },
]

export function SponsorCtaSection() {
  const sectionRef = useTimeOnScreen({ sectionId: SECTION_ID })
  const reduceMotion = useReducedMotion()

  const cardsContainer = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.12 } },
  }
  const cardItem = {
    hidden: reduceMotion ? {} : { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' } },
  }

  return (
    <section
      ref={sectionRef}
      id={SECTION_ID}
      aria-labelledby="seja-patrocinador-heading"
      className="relative overflow-hidden"
      style={{ background: NAVY }}
    >
      <div className="container py-16 md:py-24 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <Badge className="border-0 text-white" style={{ background: RED }}>
            Patrocínio
          </Badge>
          <h2 id="seja-patrocinador-heading" className="mt-4 text-3xl md:text-5xl font-extrabold">
            Seja um patrocinador da L.V.J.
          </h2>
          <p className="mt-4 text-slate-200 text-base md:text-lg">
            Associe sua marca à paixão de centenas de atletas e torcedores. Apoie o voleibol de
            Jundiaí e ganhe visibilidade em jogos, redes sociais e material oficial da liga.
          </p>
          <Button asChild size="lg" className="mt-8 text-white border-0" style={{ background: RED }}>
            <a
              href={`mailto:${SPONSOR_EMAIL}?subject=${encodeURIComponent(SPONSOR_EMAIL_SUBJECT)}`}
              aria-label="Enviar e-mail para a liga e se tornar um patrocinador"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Quero patrocinar
            </a>
          </Button>
        </div>

        <motion.div
          initial={reduceMotion ? 'show' : 'hidden'}
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={cardsContainer}
          className="mt-12 grid gap-6 sm:grid-cols-3"
        >
          {SPONSOR_TIERS.map((tier) => {
            const Icon = tier.icon
            return (
              <motion.article key={tier.id} variants={cardItem} aria-label={`Cota de patrocínio ${tier.name}`}>
                <Card
                  className="h-full border-2 bg-white/5 text-white backdrop-blur-sm"
                  style={{ borderColor: tier.highlight ? RED : 'rgba(255,255,255,0.15)' }}
                >
                  <CardHeader>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: tier.highlight ? RED : BLUE }}
                    >
                      <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <CardTitle className="mt-3 text-white">Cota {tier.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-slate-200">
                      {tier.benefits.map((benefit) => (
                        <li key={benefit}>• {benefit}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.article>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
