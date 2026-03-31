'use client'
import React, { useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './other.module.css'
import type { OtherProps } from './types'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { OtherTitle } from './OtherTitle'

export const Other: React.FC<OtherProps> = ({
  arrivalTime,
}) => {
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const titleText = 'INFORMATION'
  const visibleChars = useTitleAnimation(containerRef, titleText)
  // PartyInfo と同じ r=0/1/2 のルールで受付時間を決定し、それを挙式参列のお願いの時刻としても使う
  const receptionCodeRaw = searchParams.get('r') ?? searchParams.get('reception') ?? '2'
  const receptionCode = (receptionCodeRaw ?? '').toString()
  const derivedArrivalTime =
    receptionCode === '0'
      ? '14:00'
      : receptionCode === '1'
        ? '14:20'
        : '14:40'
  const effectiveArrivalTime = arrivalTime ?? derivedArrivalTime
  const displayArrivalTime = (() => {
    const matched = effectiveArrivalTime.match(/^(\d{1,2}):(\d{2})$/)
    if (!matched) return effectiveArrivalTime
    const [, hour, minute] = matched
    return `${Number(hour)}時${minute}分`
  })()

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.titleSection}>
          <OtherTitle titleText={titleText} visibleChars={visibleChars} />
        </div>
        
        <div className={styles.divider}></div>
        
        <div className={styles.sectionTitle}>その他のご案内</div>
        
        <div className={styles.divider}></div>
        
        <div className={styles.requestBox}>
          <div className={styles.boxHeader}>挙式参列のお願い</div>
          <div className={styles.boxDivider}></div>
          <div className={styles.boxContent}>
            <p>誠に恐れ入りますが</p>
            <p>挙式にもご列席賜りたく</p>
            <p>当日は{displayArrivalTime}迄に</p>
            <p>ご光来のほど</p>
            <p>よろしくお願い申し上げます</p>
          </div>
        </div>

        <div className={styles.requestBox}>
          <div className={styles.boxHeader}>＜シャトルバスのご案内＞</div>
          <div className={styles.boxDivider}></div>
          <div className={styles.busInfo}>
            <p className={styles.busLead}>JR二宮駅から会場までシャトルバスをご用意しております</p>
            <p className={styles.busLead}>下記ダイヤにて運行を予定しておりますので ぜひご利用くださいませ</p>

            <div className={styles.busTimeBlock}>
              <div className={styles.busTimeRow}>
                <span className={styles.busLabel}>行き</span>
                <div className={styles.busTimes}>
                  <span className={styles.busTimeChip}>13:45</span>
                  <span className={styles.busTimeChip}>14:00</span>
                  <span className={styles.busTimeChip}>14:15</span>
                </div>
              </div>
              <p className={styles.busPlace}>乗車場所：二宮駅北口右階段降りた線路沿い</p>
              <div className={styles.busTimeRow}>
                <span className={styles.busLabel}>帰り</span>
                <div className={styles.busTimes}>
                  <span className={styles.busTimeChip}>18:45</span>
                  <span className={styles.busTimeChip}>19:00</span>
                  <span className={styles.busTimeChip}>19:15</span>
                </div>
              </div>
            </div>

            <p className={styles.busNote}>※バスは定刻になりましたら発車いたしますので、乗り遅れのないようご注意くださいませ</p>
            <p className={styles.busContact}>当日ご不明点等ございましたら式場までご連絡ください（0463-43-1611）</p>
          </div>
        </div>
      </div>
    </div>
  )
}

