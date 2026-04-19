'use client'
import React, { useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './partyInfo.module.css'
import type { PartyInfoProps } from './types'
import { useTitleAnimation } from '../../hooks/useTitleAnimation'
import { PartyTitle } from './PartyTitle'

const buildMapsEmbedUrl = (query: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`

export const PartyInfo: React.FC<PartyInfoProps> = ({
  date = '2026/07/18 (土)',
  ceremonyStartTime = '15:00',
  receptionStaffTime = '14:00',
  receptionFamilyTime = '14:15',
  receptionGuestTime = '14:40',
  closingTime = '18:30',
  venueName = '指帆亭',
  venueAddress = '〒259-0123 神奈川県中郡二宮町二宮下向浜36',
  venuePhone = '📞 0463-43-1611',
  venueEmbedUrl,
}) => {
  const searchParams = useSearchParams()
  const venueMapSrc = venueEmbedUrl ?? buildMapsEmbedUrl(`${venueName} ${venueAddress}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleText1 = 'PARTY'
  const titleText2 = 'INFORMATION'
  const receptionCodeRaw = searchParams.get('r') ?? searchParams.get('reception') ?? '2'
  const receptionCode = (receptionCodeRaw ?? '').toString()
  const receptionTime =
    receptionCode === '0'
      ? receptionStaffTime
      : receptionCode === '1'
        ? receptionFamilyTime
        : receptionGuestTime

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
            <span className={styles.timeLabel}>挙式時間</span>
            <span className={styles.timeValue}>{ceremonyStartTime}</span>
          </div>
          <div className={styles.timeRow}>
            <span className={styles.timeLabel}>受付時間</span>
            <span className={styles.timeValue}>{receptionTime}</span>
            <span className={styles.timeSeparator}>/</span>
            <span className={styles.timeLabel}>お披楽喜</span>
            <span className={styles.timeValue}>{closingTime}</span>
          </div>
        </div>
        
        {receptionCode === '0' ? (
          <div className={styles.requestBox}>
            <div className={styles.requestBadge}>お受付担当のご依頼</div>
            <p className={styles.requestText}>
              当日はお受付担当をお願いしたく<br />
              誠に恐縮ですが{receptionStaffTime}までに<br />
              お越しいただきますようお願い申し上げます
            </p>
          </div>
        ) : (
          <div className={styles.requestBox}>
            <p className={styles.requestText}>
              誠に恐れ入りますが<br />
              挙式にもご列席賜りたく<br />
              当日は{receptionTime}迄に<br />
              ご光来のほど<br />
              よろしくお願い申し上げます
            </p>
          </div>
        )}

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
