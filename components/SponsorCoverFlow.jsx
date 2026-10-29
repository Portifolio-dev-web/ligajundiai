'use client'

import { useState } from 'react'
import Image from 'next/image'
import { sponsorImageVariant } from '@/lib/sponsorImage'

export function SponsorCoverFlow({ sponsors }) {
  const [center, setCenter] = useState(0)
  // Um patrocinador sem logo (ex.: cadastrado pelo admin antes de subir a imagem — logo_url
  // nasce '' no banco) quebraria o <Image> do Next, que exige um src válido.
  const withLogo = sponsors.filter((s) => s.logo_url)
  if (!withLogo.length) return null
  const n = withLogo.length

  return (
    <div>
      <div className="relative mx-auto h-[92px] w-full max-w-[260px]">
        {withLogo.map((s, i) => {
          let offset = i - center
          if (offset > n / 2) offset -= n
          if (offset < -n / 2) offset += n
          const abs = Math.abs(offset)
          if (abs > 2) return null
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCenter(i)}
              aria-label={s.name}
              aria-current={offset === 0}
              className="absolute left-1/2 top-1/2 h-[62px] w-[62px] overflow-hidden rounded-lg shadow-lg transition-all duration-300"
              style={{
                opacity: abs === 0 ? 1 : abs === 1 ? 0.55 : 0.25,
                zIndex: 10 - abs,
                transform: `translate(-50%, -50%) translateX(${offset * 42}px) scale(${abs === 0 ? 1 : 0.62}) rotateY(${offset * -20}deg)`,
                filter: abs === 0 ? 'none' : 'blur(1px)',
                pointerEvents: abs > 2 ? 'none' : 'auto',
              }}
            >
              <Image
                src={sponsorImageVariant(s.logo_url, 'coverflow')}
                alt={s.name}
                fill
                sizes="96px"
                className="object-cover"
                loading="lazy"
              />
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setCenter((c) => (c - 1 + n) % n)}
          aria-label="Patrocinador anterior"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setCenter((c) => (c + 1) % n)}
          aria-label="Próximo patrocinador"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
        >
          ›
        </button>
      </div>
      <div className="mt-1.5 text-center text-[11px] font-semibold text-slate-200">{withLogo[center]?.name}</div>
    </div>
  )
}
