'use client'
import React, { useRef } from 'react'
import styles from './partyInfo.module.css'
import type { PartyInfoProps } from './types'
import { useTitleAnimation } from './hooks/useTitleAnimation'
import { PartyTitle } from './PartyTitle'

/** 住所から地図埋め込み用URLを生成（venueEmbedUrl が無いときに使用） */
const buildMapsEmbedUrl = (query: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`

export const PartyInfo: React.FC<PartyInfoProps> = ({
  date = '2026/07/18 (土)',
  ceremonyStartTime = 'HH : MM',
  receptionTime = 'HH:MM',
  endTime = 'HH:MM',
  venueName = '指帆亭',
  venueAddress = '〒259-0123 神奈川県中郡二宮町二宮下向浜36',
  venuePhone = '📞 0463-43-1611',
  venueEmbedUrl,
}) => {
  const venueMapSrc = venueEmbedUrl ?? buildMapsEmbedUrl(`${venueName} ${venueAddress}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleText1 = 'PARTY'
  const titleText2 = 'INFORMATION'

  const partyAnimationDuration = titleText1.length * 100 + 300
  const visibleChars1 = useTitleAnimation(containerRef, titleText1, 0)
  const visibleChars2 = useTitleAnimation(containerRef, titleText2, partyAnimationDuration)

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.titleSection}>
          <PartyTitle titleText={titleText1} visibleChars={visibleChars1} />
          <PartyTitle titleText={titleText2} visibleChars={visibleChars2} />
        </div>
        
        <div className={styles.ceremonyBox}>
          <div className={styles.boxTitle}>挙式 / 披露宴</div>
          <div className={styles.dateSection}>
            <div className={styles.dateLabel}>開催日</div>
            <div className={styles.dateValue}>{date}</div>
          </div>
          <div className={styles.timeRow}>
            <span className={styles.timeLabel}>開始時刻</span>
            <span className={styles.timeValue}>{ceremonyStartTime}</span>
          </div>
          <div className={styles.timeRow}>
            <span className={styles.timeLabel}>受付</span>
            <span className={styles.timeValue}>{receptionTime}</span>
            <span className={styles.timeSeparator}>/</span>
            <span className={styles.timeLabel}>終了予定</span>
            <span className={styles.timeValue}>{endTime}</span>
          </div>
        </div>
        
        <div className={styles.venueBox}>
          <div className={styles.boxTitle}>会場情報</div>
          <div className={styles.venueRow}>
            <span className={styles.venueValue}>{venueName}</span>
          </div>
          <div className={styles.venueRow}>
            <span className={styles.venueValue}>{venueAddress}</span>
          </div>
          <div className={styles.venueRow}>
            <span className={styles.venueValue}>{venuePhone}</span>
          </div>
          <div className={styles.venueMap}>
            <iframe
              src={venueMapSrc}
              title="会場の地図"
              className={styles.venueMapEmbed}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
