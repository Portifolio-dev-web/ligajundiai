'use client'

import { useEffect, useRef } from 'react'
import { reportSectionView } from '@/lib/sectionAnalytics'

const TICK_MS = 1000
const DEFAULT_THRESHOLD = 0.5

// PERFORMANCE: o tempo acumulado e o id do setInterval vivem em refs, não em useState — um
// cronômetro em estado React re-renderizaria a seção (e tudo que ela contém) a cada segundo só
// para medir quanto tempo ela mesma passou visível, sem nenhum valor visual que dependa disso.
// Por isso o hook devolve só o `ref` a ser preso na <section> — nada aqui participa do ciclo de
// render dos componentes que o chamam.
export function useTimeOnScreen({ sectionId, onReport = reportSectionView, threshold = DEFAULT_THRESHOLD } = {}) {
  const sectionRef = useRef(null)
  const elapsedSecondsRef = useRef(0)
  const intervalIdRef = useRef(null)
  const reportedRef = useRef(false)

  useEffect(() => {
    const node = sectionRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const startTicking = () => {
      if (intervalIdRef.current !== null) return
      intervalIdRef.current = setInterval(() => {
        elapsedSecondsRef.current += 1
      }, TICK_MS)
    }

    // Pausar não zera elapsedSecondsRef — é só isso que faz o cronômetro "retomar de onde parou"
    // quando a seção volta a ficar visível, sem nenhuma lógica extra de retomada.
    const stopTicking = () => {
      if (intervalIdRef.current === null) return
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }

    const flush = () => {
      stopTicking()
      // reportedRef evita um segundo disparo: no fechamento da aba, tanto "beforeunload" quanto o
      // cleanup deste efeito (desmontagem) podem rodar; sem a guarda, o mesmo tempo seria
      // reportado duas vezes.
      if (reportedRef.current || elapsedSecondsRef.current <= 0) return
      reportedRef.current = true
      onReport({ sectionId, timeSpentInSeconds: elapsedSecondsRef.current })
    }

    // threshold: 0.5 => a 50% de visibilidade a razão cruza o limiar e o observer dispara de
    // novo, em qualquer direção (entrando ou saindo) — é esse cruzamento que inicia/pausa o
    // cronômetro, sem precisar de um segundo listener de scroll.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= threshold) startTicking()
        else stopTicking()
      },
      { threshold },
    )
    observer.observe(node)
    window.addEventListener('beforeunload', flush)

    return () => {
      observer.disconnect()
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [sectionId, onReport, threshold])

  return sectionRef
}
