'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './countDown.module.css'
import type { CountDownProps } from './types'
import { BubbleBackground } from './BubbleBackground'
import { CountDownTitle } from './CountDownTitle'
import { WeddingDayScreen } from './WeddingDayScreen'
import { useTitleAnimation } from '../../hooks/useTitleAnimation'

const TARGET_DATE = new Date('2026-07-18T00:00:00+09:00')
const WEDDING_DATE = '2026-07-18'

export const CountDown: React.FC<CountDownProps> = () => {
  const [isWeddingDay, setIsWeddingDay] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const dateSectionRef = useRef<HTMLDivElement>(null)
  const titleText = 'COUNTDOWN'
  const visibleChars = useTitleAnimation(dateSectionRef, titleText)

  useEffect(() => {
    const checkWeddingDay = () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
      setIsWeddingDay(today === WEDDING_DATE)
    }
    checkWeddingDay()
    const interval = setInterval(checkWeddingDay, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = TARGET_DATE.getTime() - Date.now()
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }
    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number) => num.toString().padStart(2, '0')

  if (isWeddingDay) return <WeddingDayScreen />

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
