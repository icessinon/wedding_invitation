'use client'

import React from 'react'
import styles from './weddingDay.module.css'

const FIREWORKS = [
  { top: 18, left: 20, color: '#ffb7e4', delay: 0 },
  { top: 25, left: 72, color: '#ffe0a0', delay: 0.7 },
  { top: 55, left: 15, color: '#a0e4ff', delay: 1.3 },
  { top: 60, left: 65, color: '#c0ffb0', delay: 0.4 },
  { top: 35, left: 45, color: '#ffb0b0', delay: 1.8 },
  { top: 75, left: 40, color: '#d4a0ff', delay: 1.0 },
]

export const WeddingDayScreen: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.waveTop} />
      <div className={styles.waveBottom} />

      {FIREWORKS.map((fw, i) => (
        <div
          key={i}
          className={styles.firework}
          style={{
            top: `${fw.top}%`,
            left: `${fw.left}%`,
            '--fw-color': fw.color,
            animationDelay: `${fw.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      <div className={styles.content}>
        <p className={styles.eyebrow}>Today is the day</p>
        <h1 className={styles.title}>本日挙式</h1>
        <div className={styles.divider}>✦ ✦ ✦</div>
        <p className={styles.message}>
          本日はご多用中にもかかわらず<br />
          お集まりいただき<br />
          誠にありがとうございます
        </p>
        <p className={styles.date}>2026.07.18</p>
      </div>
    </div>
  )
}
