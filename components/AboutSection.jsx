'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Volleyball } from 'lucide-react'
import { useTimeOnScreen } from '@/hooks/use-time-on-screen'
import { NAVY, RED } from '@/lib/theme'

const SECTION_ID = 'quem-somos'

export function AboutSection() {
  const sectionRef = useTimeOnScreen({ sectionId: SECTION_ID })
  const reduceMotion = useReducedMotion()

  const fadeUp = {
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' },
  }

  return (
    <section ref={sectionRef} id={SECTION_ID} aria-labelledby="quem-somos-heading" className="bg-white border-y">
      <div className="container py-16 md:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white"
            style={{ background: RED }}
          >
            <Volleyball className="h-3.5 w-3.5" aria-hidden="true" />
            Quem somos
          </span>
          <h2 id="quem-somos-heading" className="mt-4 text-3xl md:text-4xl font-extrabold" style={{ color: NAVY }}>
            A casa do vôlei jundiaiense desde 2018
          </h2>
          <article className="mx-auto mt-6 max-w-2xl text-left">
            <p className="text-slate-600 text-base md:text-lg leading-relaxed">
              A Liga de Voleibol de Jundiaí (L.V.J.) foi fundada em 2018 com o firme propósito de
              transformar e elevar o patamar do voleibol regional na cidade de Jundiaí e em todos
              os municípios vizinhos. O que começou como um movimento para unir equipes e atletas
              locais consolidou-se como a principal referência do voleibol amador e de alto
              rendimento da região metropolitana. Com imenso orgulho, realizamos nossas temporadas
              oficiais celebrando a confiança das equipes, o empenho das comissões técnicas e a
              paixão vibrante de centenas de atletas e torcedores.
            </p>
          </article>
        </motion.div>
      </div>
    </section>
  )
}
