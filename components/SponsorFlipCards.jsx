'use client'

import { useState } from 'react'
import Image from 'next/image'
import { NAVY } from '@/lib/theme'
import { sponsorImageVariant } from '@/lib/sponsorImage'

export function SponsorFlipCards({ sponsors }) {
  if (!sponsors.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {sponsors.map((s) => (
        <FlipCard key={s.id} sponsor={s} />
      ))}
    </div>
  )
}

function FlipCard({ sponsor }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-label={`Patrocinador: ${sponsor.name}`}
      aria-pressed={flipped}
      className="relative h-[92px] w-full text-left"
      style={{ perspective: '800px' }}
    >
      <div
        className="relative h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-lg border bg-white [backface-visibility:hidden]"
          style={{ borderColor: '#e2e8f0' }}
        >
          <Image
            src={sponsorImageVariant(sponsor.logo_url, 'flip')}
            alt={sponsor.name}
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain"
            loading="lazy"
          />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg px-2 text-center text-xs font-semibold text-white [backface-visibility:hidden]"
          style={{ background: NAVY, transform: 'rotateY(180deg)' }}
        >
          {sponsor.name}
        </div>
      </div>
    </button>
  )
}
