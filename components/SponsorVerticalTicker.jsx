'use client'

import Image from 'next/image'
import { NAVY } from '@/lib/theme'
import { sponsorImageVariant } from '@/lib/sponsorImage'

// PERFORMANCE: mesmo princípio do carrossel horizontal — só `transform` (translateY) rodando no
// compositor. A lista é duplicada (ver `loop`) só pra o translateY(-50%) fechar o laço sem salto;
// a cópia é decorativa, por isso some de leitores de tela e some da tela em "reduzir movimento".
export function SponsorVerticalTicker({ sponsors }) {
  if (!sponsors.length) return null
  const loop = [...sponsors, ...sponsors]

  return (
    <div className="relative h-[260px] overflow-hidden" style={{ background: NAVY }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8"
        style={{ background: `linear-gradient(${NAVY}, transparent)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8"
        style={{ background: `linear-gradient(0deg, ${NAVY}, transparent)` }}
      />
      <div
        className="flex h-max flex-col motion-safe:animate-sponsor-scroll-v motion-reduce:h-full motion-reduce:overflow-y-auto hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
        style={{ willChange: 'transform' }}
      >
        {loop.map((s, i) => {
          const duplicate = i >= sponsors.length
          return (
            <div
              key={`${s.id}-${i}`}
              className={`relative mx-3 my-1 h-[76px] flex-none overflow-hidden rounded-md ${duplicate ? 'motion-reduce:hidden' : ''}`}
              aria-hidden={duplicate}
              title={s.name}
            >
              <Image
                src={sponsorImageVariant(s.logo_url, 'vticker')}
                alt={s.name}
                fill
                sizes="300px"
                className="object-contain"
                loading="lazy"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
