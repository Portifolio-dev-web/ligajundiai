'use client'

import { motion } from 'framer-motion'
import { Volleyball, Users, HeartHandshake, Trophy } from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.6, ease: 'easeOut' },
}

const TEXTO = `A Liga de Voleibol de Jundiaí (L.V.J.) foi fundada em 2018 com o firme propósito de
transformar e elevar o patamar do voleibol regional na cidade de Jundiaí e em todos
os municípios vizinhos. O que começou como um movimento para unir equipes e atletas
locais consolidou-se como a principal referência do voleibol amador e de alto
rendimento da região metropolitana. Com imenso orgulho, realizamos nossas temporadas
oficiais celebrando a confiança das equipes, o empenho das comissões técnicas e a
paixão vibrante de centenas de atletas e torcedores.`

function Badge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-red px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white">
      <Volleyball className="h-3.5 w-3.5" aria-hidden="true" />
      Quem somos
    </span>
  )
}

function Option1() {
  const chips = [
    { label: 'Fundação', value: '2018' },
    { label: 'Nível', value: 'Amador e alto rendimento' },
    { label: 'Abrangência', value: 'Jundiaí e região' },
  ]
  return (
    <section className="bg-white border-y">
      <div className="container py-16 md:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Badge />
          <h2 className="mt-4 text-3xl md:text-4xl font-extrabold text-brand-navy">
            A casa do vôlei jundiaiense desde 2018
          </h2>
          <article className="mx-auto mt-6 max-w-2xl text-left">
            <p className="text-slate-600 text-base md:text-lg leading-relaxed whitespace-pre-line">
              {TEXTO}
            </p>
          </article>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            {chips.map((c) => (
              <div key={c.label} className="rounded-xl border border-brand-navy/15 bg-brand-navy/[0.03] px-4 py-5 text-center">
                <p className="text-xl font-extrabold text-brand-red">{c.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-navy/70">{c.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Option2() {
  const pilares = [
    { icon: Trophy, titulo: 'Missão', texto: 'Elevar o patamar do vôlei regional em Jundiaí e nos municípios vizinhos.' },
    { icon: HeartHandshake, titulo: 'Comunidade', texto: 'Unir equipes, atletas e comissões técnicas locais em torno do esporte.' },
    { icon: Users, titulo: 'Competição', texto: 'Temporadas oficiais com centenas de atletas e torcedores todo ano.' },
  ]
  return (
    <section className="bg-white border-y">
      <div className="container py-16 md:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-5xl">
          <div className="text-center md:text-left">
            <Badge />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy">
                A casa do vôlei jundiaiense desde 2018
              </h2>
              <p className="mt-6 text-slate-600 text-base md:text-lg leading-relaxed whitespace-pre-line">
                {TEXTO}
              </p>
            </div>
            <div className="space-y-4">
              {pilares.map(({ icon: Icon, titulo, texto }) => (
                <div key={titulo} className="flex gap-4 rounded-xl border border-brand-navy/15 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-red">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-navy">{titulo}</p>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">{texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Option3() {
  return (
    <section className="bg-white border-y">
      <div className="container py-16 md:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-5xl grid grid-cols-1 gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <Badge />
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold text-brand-navy">
              A casa do vôlei jundiaiense desde 2018
            </h2>
            <p className="mt-6 text-slate-600 text-base md:text-lg leading-relaxed whitespace-pre-line">
              {TEXTO}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-navy px-8 py-10 text-center text-white">
            <p className="text-6xl font-extrabold text-brand-red">2018</p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-white/80">
              Ano de fundação da Liga de Voleibol de Jundiaí
            </p>
            <div className="mx-auto mt-6 h-px w-16 bg-white/20" />
            <p className="mt-6 text-sm text-white/70 leading-relaxed">
              Hoje, principal referência do vôlei amador e de alto rendimento da região
              metropolitana de Jundiaí.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default function PreviewQuemSomos() {
  return (
    <main>
      <div className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
        Página temporária de comparação — não faz parte do site final.
      </div>

      <div className="border-t-8 border-brand-red" />
      <p className="container pt-6 text-sm font-bold text-brand-navy">Opção 1 — Minimalista + estatísticas</p>
      <Option1 />

      <div className="border-t-8 border-brand-red" />
      <p className="container pt-6 text-sm font-bold text-brand-navy">Opção 2 — Dividida: texto + destaques</p>
      <Option2 />

      <div className="border-t-8 border-brand-red" />
      <p className="container pt-6 text-sm font-bold text-brand-navy">Opção 3 — Faixa com destaque em bloco colorido</p>
      <Option3 />
    </main>
  )
}
