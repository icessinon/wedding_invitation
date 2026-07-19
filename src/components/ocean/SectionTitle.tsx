'use client'

import React, { useEffect, useRef, useState } from 'react'
import styles from './ocean.module.css'

interface SectionTitleProps {
  /** 筆記体の英字タイトル（例: Thanks） */
  en: string
  /** 和文サブタイトル（任意） */
  ja?: string
}

/** 全セクション共通の見出し。スクロールで表れるとふわっと浮き上がる */
export const SectionTitle: React.FC<SectionTitleProps> = ({ en, ja }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${styles.sectionTitle} ${visible ? styles.sectionTitleVisible : ''}`}
    >
      <p className={styles.sectionTitleEn}>{en}</p>
      <span className={styles.sectionTitleRule} aria-hidden="true" />
      {ja && <p className={styles.sectionTitleJa}>{ja}</p>}
    </div>
  )
}
