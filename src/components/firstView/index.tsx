'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import styles from './firstView.module.css'
import type { FirstViewProps } from './types'
import { useTitleAnimation } from '../../hooks/useTitleAnimation'
import { FirstViewTitle } from './FirstViewTitle'

const TITLE_LINES = ['Wedding', 'Invitation'] as const
const TITLE_TEXT = TITLE_LINES.join('')

const PARTICLES = [
  { dx: -22, dy: -48, size: 3, color: 'rgba(120,220,255,0.95)' },
  { dx:  18, dy: -55, size: 4, color: 'rgba(200,245,255,0.90)' },
  { dx: -38, dy: -28, size: 2, color: 'rgba(255,255,255,0.95)' },
  { dx:  40, dy: -32, size: 3, color: 'rgba(80,210,250,0.90)'  },
  { dx:  -8, dy: -60, size: 2, color: 'rgba(160,235,255,0.85)' },
  { dx:  12, dy: -50, size: 4, color: 'rgba(180,240,255,0.88)' },
  { dx: -30, dy: -18, size: 2, color: 'rgba(100,225,255,0.90)' },
  { dx:  28, dy: -22, size: 3, color: 'rgba(220,248,255,0.85)' },
  { dx:  -5, dy: -38, size: 2, color: 'rgba(140,230,255,0.90)' },
  { dx:  45, dy: -12, size: 2, color: 'rgba(255,255,255,0.80)' },
]

type Splash = { id: number; x: number; y: number }

export const FirstView: React.FC<FirstViewProps> = ({
  weddingDate = '2026年7月18日（土）',
  weddingDateTime = '2026-07-18',
  dateLabel = 'ご婚礼日',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleChars = useTitleAnimation(containerRef, TITLE_TEXT)
  const [splashes, setSplashes] = useState<Splash[]>([])
  const [vortexActive, setVortexActive] = useState(false)
  const [vortexTextActive, setVortexTextActive] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const lastSplashRef = useRef(0)
  const splashCountRef = useRef(0)

  useEffect(() => {
    if (sessionStorage.getItem('rsvp_done') === '1') setSubmitted(true)
    const onDone = () => setSubmitted(true)
    window.addEventListener('rsvp-done', onDone)
    return () => window.removeEventListener('rsvp-done', onDone)
  }, [])

  const titleComplete = visibleChars >= TITLE_TEXT.length

  const addSplash = useCallback((clientX: number, clientY: number) => {
    const now = Date.now()
    if (now - lastSplashRef.current < 120) return
    lastSplashRef.current = now
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const id = now
    const x = clientX - rect.left
    const y = clientY - rect.top
    setSplashes(prev => [...prev, { id, x, y }])
    setTimeout(() => setSplashes(prev => prev.filter(s => s.id !== id)), 1600)

    splashCountRef.current += 1
    if (splashCountRef.current >= 7) {
      splashCountRef.current = 0
      setVortexActive(true)
      setTimeout(() => setVortexActive(false), 5800)
      setVortexTextActive(true)
      setTimeout(() => setVortexTextActive(false), 6000)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onClick={(e) => addSplash(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t) addSplash(t.clientX, t.clientY)
      }}
    >
      <div className={styles.backgroundImage} />
      <div className={styles.overlay} />

      {splashes.map(s => (
        <div key={s.id} className={styles.splash} style={{ left: s.x, top: s.y }}>
          <span className={styles.splashRipple} />
          <span className={styles.splashRipple2} />
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className={styles.splashParticle}
              style={{
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--size': `${p.size}px`,
                '--pcolor': p.color,
                '--delay': `${i * 18}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      ))}

      {vortexActive && (
        <div className={styles.vortex}>
          {[...Array(8)].map((_, i) => (
            <span key={i} className={styles.vortexRing} style={{ '--ri': i } as React.CSSProperties} />
          ))}
          <span className={styles.vortexCore} />
        </div>
      )}

      <div className={`${styles.mainContent} ${vortexActive ? styles.mainContentSwallowed : ''}`}>
        <FirstViewTitle
          titleLines={submitted ? ['Thank You', 'So Much'] : [...TITLE_LINES]}
          visibleChars={visibleChars}
        />
        <div className={`${styles.dateBlock} ${titleComplete ? styles.dateBlockVisible : ''}`}>
          <p className={styles.dateEyebrow}>{dateLabel}</p>
          <time className={styles.dateMain} dateTime={weddingDateTime}>
            {weddingDate}
          </time>
        </div>
      </div>

      {vortexTextActive && (
        <p className={styles.vortexText}>
          {submitted ? "Can\u2019t Get Enough?" : "Let\u2019s Enjoy Together"}
        </p>
      )}
    </div>
  )
}
