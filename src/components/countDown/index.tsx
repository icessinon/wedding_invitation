'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './countDown.module.css'
import type { CountDownProps } from './types'
import { BubbleBackground } from './BubbleBackground'
import { CountDownTitle } from './CountDownTitle'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'

const TARGET_DATE = new Date('2026-07-17T00:00:00')

export const CountDown: React.FC<CountDownProps> = (props) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const target = TARGET_DATE.getTime()
      const difference = target - now

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)

        setTimeLeft({ days, hours, minutes, seconds })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, '0')
  }

  const dateSectionRef = useRef<HTMLDivElement>(null)
  const titleText = 'COUNTDOWN'
  const visibleChars = useTitleAnimation(dateSectionRef, titleText)

  return (
    <div className={styles.container}>
      <div className={styles.waveTop}></div>
      <div className={styles.waveBottom}></div>
      <BubbleBackground />
      
      <div className={styles.mainContent}>
        <CountDownTitle titleText={titleText} visibleChars={visibleChars} />
        <div className={styles.topSection}>
          <span className={styles.daysNumber}>{formatNumber(timeLeft.days)}</span>
          <span className={styles.daysLabel}>days</span>
        </div>

        <div className={styles.timeSection}>
          <div className={styles.timeUnit}>
            <div className={styles.timeValue}>{formatNumber(timeLeft.hours)}</div>
            <div className={styles.timeLabel}>HOURS</div>
          </div>
          <div className={styles.timeUnit}>
            <div className={styles.timeValue}>{formatNumber(timeLeft.minutes)}</div>
            <div className={styles.timeLabel}>MINUTES</div>
          </div>
          <div className={styles.timeUnit}>
            <div className={styles.timeValue}>{formatNumber(timeLeft.seconds)}</div>
            <div className={styles.timeLabel}>SECONDS</div>
          </div>
        </div>

        <div ref={dateSectionRef} className={styles.dateSection}>
          <span className={styles.dateText}>to 2026/07/18</span>
        </div>
      </div>
    </div>
  )
}

