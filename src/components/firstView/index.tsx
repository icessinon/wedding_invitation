'use client'

import React, { useEffect, useState, useRef } from 'react'
import styles from './firstView.module.css'
import type { FirstViewProps } from './types'
import { useHeroTitleAnimation } from './hooks/useHeroTitleAnimation'
import { FirstViewTitle } from './FirstViewTitle'

const TITLE_LINES = ['Wedding', 'Invitation'] as const
const TITLE_TEXT = TITLE_LINES.join('')

export const FirstView: React.FC<FirstViewProps> = ({
  weddingDate = '2026年7月18日（土）',
  weddingDateTime = '2026-07-18',
  dateLabel = 'ご婚礼日',
}) => {
  const [scrollY, setScrollY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleChars = useHeroTitleAnimation(containerRef, TITLE_TEXT)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const titleComplete = visibleChars >= TITLE_TEXT.length

  return (
    <div ref={containerRef} className={styles.container}>
      <div
        className={styles.backgroundImage}
        style={{
          transform: `translateY(${scrollY * 0.5}px)`,
        }}
      />
      <div className={styles.overlay} />

      <div className={styles.mainContent}>
        <FirstViewTitle titleLines={[...TITLE_LINES]} visibleChars={visibleChars} />
        <div className={`${styles.dateBlock} ${titleComplete ? styles.dateBlockVisible : ''}`}>
          <p className={styles.dateEyebrow}>{dateLabel}</p>
          <time className={styles.dateMain} dateTime={weddingDateTime}>
            {weddingDate}
          </time>
        </div>
      </div>
    </div>
  )
}
